import * as savedWebRecipesService from './savedWebRecipesService';

export interface RecipeFilters {
  maxReadyTime?: number;
  vegetarian?: boolean;
}
import * as generatedRecipesService from './generatedRecipesService';

/** Recipe shape for saved web recipes (same card display as API recipes). */
export interface WebRecipeSummary {
  id: string;
  title: string;
  image: string | null;
  readyInMinutes?: number;
  extendedIngredients: { name: string; original?: string }[];
  sourceUrl: string | null;
}

/** Recipe shape for LLM-generated recipes (card + detail). */
export interface GeneratedRecipeSummary {
  id: string;
  title: string;
  image: string | null;
  readyInMinutes?: number;
  extendedIngredients: { name: string; original?: string }[];
  sourceUrl: null;
}

export type RecipeWithSource =
  | { source: 'generated'; recipe: GeneratedRecipeSummary }
  | { source: 'web'; recipe: WebRecipeSummary };

function savedToWebRecipe(row: savedWebRecipesService.SavedWebRecipe): WebRecipeSummary {
  return {
    id: String(row.id),
    title: row.title?.trim() || 'Recept från webben',
    image: row.image_url?.trim() || null,
    sourceUrl: row.source_url,
    extendedIngredients: [],
  };
}

function generatedToSummary(r: generatedRecipesService.GeneratedRecipe): GeneratedRecipeSummary {
  return {
    id: String(r.id),
    title: r.title,
    image: r.image_path ?? null,
    readyInMinutes: r.ready_in_minutes ?? undefined,
    extendedIngredients: r.ingredients.map((ing) => ({
      name: ing.name,
      original: ing.amount != null && ing.unit ? `${ing.amount} ${ing.unit} ${ing.name}` : undefined,
    })),
    sourceUrl: null,
  };
}

/**
 * Fetch recipes: generated (from DB) first, then saved web recipes from local DB.
 */
export async function findRecipesWithFallback(
  ingredients: string[],
  _filters?: RecipeFilters
): Promise<RecipeWithSource[]> {
  const list: RecipeWithSource[] = [];

  const generatedList = await generatedRecipesService.getAllForIngredients(ingredients);
  for (const r of generatedList) {
    list.push({ source: 'generated', recipe: generatedToSummary(r) });
  }

  const ingredientQuery = ingredients.slice(0, 6).join(' ').trim();
  const saved = ingredientQuery
    ? await savedWebRecipesService.getByIngredientQuery(ingredientQuery)
    : await savedWebRecipesService.getAll();
  for (const row of saved) {
    list.push({ source: 'web', recipe: savedToWebRecipe(row) });
  }

  return list;
}

/**
 * Load recipes only from local cache / DB (for offline use). Returns list and whether any data came from cache.
 */
export async function getRecipesFromCacheOnly(
  ingredients: string[],
  _filters?: RecipeFilters
): Promise<{ list: RecipeWithSource[]; fromCache: boolean }> {
  const list: RecipeWithSource[] = [];

  const generatedList = await generatedRecipesService.getAllForIngredients(ingredients);
  for (const r of generatedList) {
    list.push({ source: 'generated', recipe: generatedToSummary(r) });
  }

  const ingredientQuery = ingredients.slice(0, 6).join(' ').trim();
  const saved = ingredientQuery
    ? await savedWebRecipesService.getByIngredientQuery(ingredientQuery)
    : await savedWebRecipesService.getAll();
  for (const row of saved) {
    list.push({ source: 'web', recipe: savedToWebRecipe(row) });
  }

  return { list, fromCache: list.length > 0 };
}
