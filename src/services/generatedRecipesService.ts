import { getDb } from '../db';

export interface GeneratedRecipeIngredient {
  name: string;
  amount?: number | string;
  unit?: string;
}

export interface GeneratedRecipeStep {
  step_number?: number;
  instruction: string;
}

export interface GeneratedRecipeRow {
  id: number;
  ingredient_cache_key: string;
  title: string;
  ingredients_json: string;
  steps_json: string;
  servings: number | null;
  ready_in_minutes: number | null;
  image_path: string | null;
  created_at: number;
}

export interface GeneratedRecipe extends GeneratedRecipeRow {
  ingredients: GeneratedRecipeIngredient[];
  steps: GeneratedRecipeStep[];
}

export interface SaveGeneratedRecipeInput {
  ingredient_cache_key: string;
  title: string;
  ingredients_json: string;
  steps_json: string;
  servings?: number | null;
  ready_in_minutes?: number | null;
  image_path?: string | null;
}

function parseIngredients(json: string): GeneratedRecipeIngredient[] {
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => ({
      name: typeof item?.name === 'string' ? item.name : String(item?.name ?? ''),
      amount: item?.amount,
      unit: typeof item?.unit === 'string' ? item.unit : undefined,
    }));
  } catch {
    return [];
  }
}

function parseSteps(json: string): GeneratedRecipeStep[] {
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => ({
      step_number: typeof item?.step_number === 'number' ? item.step_number : undefined,
      instruction: typeof item?.instruction === 'string' ? item.instruction : String(item?.instruction ?? ''),
    }));
  } catch {
    return [];
  }
}

function rowToRecipe(row: GeneratedRecipeRow): GeneratedRecipe {
  return {
    ...row,
    ingredients: parseIngredients(row.ingredients_json),
    steps: parseSteps(row.steps_json),
  };
}

/** Build a deterministic cache key from sorted ingredient names. */
export function buildIngredientCacheKey(ingredientNames: string[]): string {
  const sorted = [...ingredientNames].map((s) => s.trim().toLowerCase()).filter(Boolean).sort();
  return sorted.join('|');
}

export async function getByIngredientKey(ingredientCacheKey: string): Promise<GeneratedRecipe | null> {
  const db = getDb();
  const row = await db.getFirstAsync<GeneratedRecipeRow>(
    'SELECT * FROM generated_recipes WHERE ingredient_cache_key = ? ORDER BY created_at DESC LIMIT 1',
    ingredientCacheKey
  );
  return row ? rowToRecipe(row) : null;
}

export async function getById(id: number): Promise<GeneratedRecipe | null> {
  const db = getDb();
  const row = await db.getFirstAsync<GeneratedRecipeRow>(
    'SELECT * FROM generated_recipes WHERE id = ?',
    id
  );
  return row ? rowToRecipe(row) : null;
}

export async function getAllForIngredients(ingredientNames: string[]): Promise<GeneratedRecipe[]> {
  const key = buildIngredientCacheKey(ingredientNames);
  const db = getDb();
  const rows = await db.getAllAsync<GeneratedRecipeRow>(
    'SELECT * FROM generated_recipes WHERE ingredient_cache_key = ? ORDER BY created_at DESC',
    key
  );
  return rows.map(rowToRecipe);
}

export async function save(input: SaveGeneratedRecipeInput): Promise<number> {
  const db = getDb();
  const ts = Math.floor(Date.now() / 1000);
  await db.runAsync(
    `INSERT INTO generated_recipes (ingredient_cache_key, title, ingredients_json, steps_json, servings, ready_in_minutes, image_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.ingredient_cache_key,
    input.title,
    input.ingredients_json,
    input.steps_json,
    input.servings ?? null,
    input.ready_in_minutes ?? null,
    input.image_path ?? null,
    ts
  );
  const row = await db.getFirstAsync<{ id: number }>('SELECT last_insert_rowid() AS id');
  return row?.id ?? 0;
}

export async function deleteById(id: number): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM generated_recipes WHERE id = ?', id);
}

/** Delete all generated recipes for the given ingredient set (same cache key). Used when replacing with a new batch. */
export async function deleteAllForIngredients(ingredientNames: string[]): Promise<void> {
  const key = buildIngredientCacheKey(ingredientNames);
  const db = getDb();
  await db.runAsync('DELETE FROM generated_recipes WHERE ingredient_cache_key = ?', key);
}

/**
 * Delete generated recipes for this ingredient set except those whose id is in keepRecipeIds.
 * Use this when replacing the batch so favorited recipes are kept and still work in Favoriter.
 */
export async function deleteAllForIngredientsExcept(
  ingredientNames: string[],
  keepRecipeIds: number[]
): Promise<void> {
  const key = buildIngredientCacheKey(ingredientNames);
  const db = getDb();
  if (keepRecipeIds.length === 0) {
    await db.runAsync('DELETE FROM generated_recipes WHERE ingredient_cache_key = ?', key);
    return;
  }
  const placeholders = keepRecipeIds.map(() => '?').join(',');
  await db.runAsync(
    `DELETE FROM generated_recipes WHERE ingredient_cache_key = ? AND id NOT IN (${placeholders})`,
    key,
    ...keepRecipeIds
  );
}
