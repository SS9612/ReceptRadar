import { normalizeProductName } from './normalizeProductName';

export interface RecipeMatchResult {
  have: number;
  total: number;
  missing: string[];
}

export interface ExtendedIngredient {
  id?: number;
  name: string;
  original?: string;
}

/** Any recipe shape that has extendedIngredients (e.g. generated or web). */
export interface RecipeWithIngredients {
  extendedIngredients?: ExtendedIngredient[];
}

/**
 * Compute how many recipe ingredients the user has in pantry.
 * Uses normalized names for matching; missing list uses original display strings.
 */
export function computeRecipeMatch(
  recipe: RecipeWithIngredients,
  pantryNormalizedNames: Set<string>
): RecipeMatchResult {
  const ingredients = recipe.extendedIngredients ?? [];
  const total = ingredients.length;
  let have = 0;
  const missing: string[] = [];

  for (const ing of ingredients) {
    const raw = (ing.name || ing.original || '').trim();
    const { normalizedName } = normalizeProductName(raw);
    const key = normalizedName.toLowerCase();
    const inPantry = key ? pantryNormalizedNames.has(key) : false;
    if (inPantry) {
      have += 1;
    } else {
      const display = (ing.original || ing.name || raw) || '?';
      missing.push(display);
    }
  }

  return { have, total, missing };
}
