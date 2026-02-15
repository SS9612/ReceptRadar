import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  buildIngredientCacheKey,
  getAllForIngredients,
  getById,
  save as saveGeneratedRecipe,
  type GeneratedRecipe,
  type GeneratedRecipeIngredient,
  type GeneratedRecipeStep,
} from './generatedRecipesService';

function getEnv(key: string): string {
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  return (extra?.[key] ?? process.env[key] ?? '').trim();
}

const AZURE_RESPONSES_API_VERSION = '2025-04-01-preview';
const AZURE_RESPONSES_PATH = '/openai/responses';
const AZURE_API_VERSION_IMAGES = '2024-02-15';

export interface LlmRecipePayload {
  title: string;
  ingredients: Array<{ name: string; amount?: number | string; unit?: string }>;
  steps: Array<{ step_number?: number; instruction: string }>;
  servings?: number;
  ready_in_minutes?: number;
}

function getAzureConfig(): {
  endpoint: string;
  apiKey: string;
  chatDeployment: string;
  imageDeployment: string | null;
} | null {
  const endpoint = getEnv('EXPO_PUBLIC_AZURE_OPENAI_ENDPOINT').replace(/\/$/, '');
  const apiKey = getEnv('EXPO_PUBLIC_AZURE_OPENAI_API_KEY');
  const chatDeployment = getEnv('EXPO_PUBLIC_AZURE_OPENAI_CHAT_DEPLOYMENT');
  const imageDeployment = getEnv('EXPO_PUBLIC_AZURE_OPENAI_IMAGE_DEPLOYMENT') || null;
  if (!endpoint || !apiKey || !chatDeployment) return null;
  return { endpoint, apiKey, chatDeployment, imageDeployment };
}

export function isLlmRecipeAvailable(): boolean {
  return getAzureConfig() !== null;
}

/** Response shape for Azure OpenAI Responses API output items. */
interface ResponsesOutputItem {
  content?: Array<{ type?: string; text?: string }>;
}

async function callAzureChat(
  endpoint: string,
  apiKey: string,
  deployment: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const url = `${endpoint}${AZURE_RESPONSES_PATH}?api-version=${AZURE_RESPONSES_API_VERSION}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      model: deployment,
      instructions: systemPrompt,
      input: userContent,
      max_output_tokens: 12000,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure Responses API failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { output?: ResponsesOutputItem[] };
  const output = data.output;
  if (!Array.isArray(output) || output.length === 0) {
    throw new Error('Azure Responses API returned no output');
  }
  const parts: string[] = [];
  for (const item of output) {
    const content = item.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === 'output_text' && typeof block.text === 'string') {
        parts.push(block.text);
      }
    }
  }
  const content = parts.join('').trim();
  if (!content) throw new Error('Azure Responses API returned no text content');
  return content;
}

async function callAzureImage(
  endpoint: string,
  apiKey: string,
  deployment: string,
  prompt: string
): Promise<{ url?: string; b64_json?: string } | null> {
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/images/generations?api-version=${AZURE_API_VERSION_IMAGES}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      model: deployment,
      prompt,
      n: 1,
      size: '1024x1024',
      style: 'vivid',
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure Images failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
  return data.data?.[0] ?? null;
}

async function downloadImageToLocalFile(imageUrl: string): Promise<string> {
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error('No document directory');
  const filename = `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.png`;
  const localPath = `${dir}${filename}`;
  const result = await FileSystem.downloadAsync(imageUrl, localPath);
  if (result.status !== 200) throw new Error(`Download failed: ${result.status}`);
  return result.uri;
}

async function saveBase64ImageToLocalFile(b64Json: string): Promise<string> {
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error('No document directory');
  const filename = `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.png`;
  const localPath = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(localPath, b64Json, {
    encoding: 'base64',
  });
  return localPath;
}

function parseOneRecipePayload(obj: Record<string, unknown>): LlmRecipePayload {
  const title = typeof obj.title === 'string' ? obj.title : 'Recept';
  const ingredients = Array.isArray(obj.ingredients)
    ? (obj.ingredients as Array<Record<string, unknown>>).map((ing) => ({
        name: typeof ing.name === 'string' ? ing.name : String(ing.name ?? ''),
        amount: typeof ing.amount === 'number' || typeof ing.amount === 'string' ? ing.amount : undefined,
        unit: typeof ing.unit === 'string' ? ing.unit : undefined,
      }))
    : [];
  const steps = Array.isArray(obj.steps)
    ? (obj.steps as Array<Record<string, unknown>>).map((s) => ({
        step_number: typeof s.step_number === 'number' ? s.step_number : undefined,
        instruction: typeof s.instruction === 'string' ? s.instruction : String(s.instruction ?? ''),
      }))
    : [];
  const servings = typeof obj.servings === 'number' ? obj.servings : undefined;
  const ready_in_minutes = typeof obj.ready_in_minutes === 'number' ? obj.ready_in_minutes : undefined;
  return { title, ingredients, steps, servings, ready_in_minutes };
}

/** Parse LLM response: either an array of 10 recipe objects or a single object (legacy). */
function parseRecipePayloadArray(raw: string): LlmRecipePayload[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid recipe JSON');
  if (Array.isArray(parsed)) {
    const out: LlmRecipePayload[] = [];
    for (let i = 0; i < Math.min(parsed.length, 10); i++) {
      const item = parsed[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        out.push(parseOneRecipePayload(item as Record<string, unknown>));
      }
    }
    return out;
  }
  return [parseOneRecipePayload(parsed as Record<string, unknown>)];
}

const SYSTEM_PROMPT = `Du är en kock. Skapa exakt 10 olika recept som en JSON-array. Varje recept ska vara ett JSON-objekt med följande fält (på svenska):
- "title": sträng, receptets titel
- "ingredients": array av objekt med "name" (sträng), valfritt "amount" (tal eller sträng), valfritt "unit" (sträng)
- "steps": array av objekt med "step_number" (tal, 1-baserat) och "instruction" (sträng, steg-för-steg)
- "servings": valfritt tal (portioner)
- "ready_in_minutes": valfritt tal (total tid i minuter)

Krav på variation: Recepten ska vara tydligt olika – bland annat olika kök (t.ex. svenskt, italienskt, asiatiskt), olika rättstyper (förrätt, huvudrätt, soppa, sallad, dessert), olika tillagningssätt (stekt, kokt, ugnsbakat, wokad) och olika smakprofiler. Använd de angivna ingredienserna i alla recept men välj varierande tillbehör och tillagning.

Svara ENDAST med en JSON-array av exakt 10 receptobjekt, ingen markdown och ingen förklaring.`;

const RECIPE_COUNT = 10;

/**
 * Generate 10 varied recipes from ingredients via Azure AI Foundry. Checks DB first by cache key; on miss calls Azure Chat, saves all to DB, returns them.
 */
export async function generateRecipe(
  ingredientNames: string[],
  options?: { includeImage?: boolean; skipCache?: boolean }
): Promise<GeneratedRecipe[]> {
  const config = getAzureConfig();
  if (!config) throw new Error('Azure AI Foundry är inte konfigurerad. Sätt EXPO_PUBLIC_AZURE_OPENAI_* i miljön.');

  const key = buildIngredientCacheKey(ingredientNames);
  if (!options?.skipCache) {
    const existing = await getAllForIngredients(ingredientNames);
    if (existing.length >= RECIPE_COUNT) return existing.slice(0, RECIPE_COUNT);
  }

  const ingredientList = ingredientNames.slice(0, 15).join(', ');
  const userPrompt = `Skapa exakt 10 olika recept som använder följande ingredienser: ${ingredientList}. Varje recept ska vara tydligt varierat (olika kök, rättstyper, tillagningssätt). Svara med en JSON-array av exakt 10 recept enligt formatet.`;

  const rawContent = await callAzureChat(
    config.endpoint,
    config.apiKey,
    config.chatDeployment,
    SYSTEM_PROMPT,
    userPrompt
  );
  const payloads = parseRecipePayloadArray(rawContent);
  if (payloads.length === 0) throw new Error('Inga recept returnerades från AI.');

  const saved: GeneratedRecipe[] = [];
  for (let i = 0; i < payloads.length; i++) {
    const payload = payloads[i];
    let imagePath: string | null = null;
    if (i === 0 && options?.includeImage !== false && config.imageDeployment) {
      try {
        const imageResult = await callAzureImage(
          config.endpoint,
          config.apiKey,
          config.imageDeployment,
          `Appetizing food photo of ${payload.title}, professional, no text`
        );
        if (Platform.OS !== 'web') {
          if (imageResult?.b64_json) {
            imagePath = await saveBase64ImageToLocalFile(imageResult.b64_json);
          } else if (imageResult?.url) {
            imagePath = await downloadImageToLocalFile(imageResult.url);
          }
        }
      } catch {
        // Continue without image
      }
    }
    const ingredientsJson = JSON.stringify(payload.ingredients as GeneratedRecipeIngredient[]);
    const stepsJson = JSON.stringify(payload.steps as GeneratedRecipeStep[]);
    const id = await saveGeneratedRecipe({
      ingredient_cache_key: key,
      title: payload.title,
      ingredients_json: ingredientsJson,
      steps_json: stepsJson,
      servings: payload.servings ?? null,
      ready_in_minutes: payload.ready_in_minutes ?? null,
      image_path: imagePath,
    });
    const recipe = await getById(id);
    if (recipe) saved.push(recipe);
  }
  return saved;
}
