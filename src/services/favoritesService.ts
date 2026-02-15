import { getDb } from '../db';

export type FavoriteProvider = 'web' | 'generated';

export interface FavoriteRecipeData {
  title?: string;
  image?: string | null;
  sourceUrl?: string | null;
}

export interface Favorite {
  id: number;
  provider: string;
  recipe_id: string;
  recipe_data: string | null;
  added_at: number;
}

export interface InsertFavorite {
  provider: FavoriteProvider;
  recipe_id: string;
  recipe_data?: string | null;
}

export async function getAll(): Promise<Favorite[]> {
  const db = getDb();
  const rows = await db.getAllAsync<Favorite>(
    'SELECT * FROM favorites ORDER BY added_at DESC'
  );
  return rows;
}

export async function getByRecipe(
  provider: string,
  recipe_id: string
): Promise<Favorite | null> {
  const db = getDb();
  const row = await db.getFirstAsync<Favorite>(
    'SELECT * FROM favorites WHERE provider = ? AND recipe_id = ?',
    provider,
    recipe_id
  );
  return row ?? null;
}

export async function create(favorite: InsertFavorite): Promise<Favorite> {
  const db = getDb();
  const ts = Math.floor(Date.now() / 1000);
  await db.runAsync(
    'INSERT INTO favorites (provider, recipe_id, recipe_data, added_at) VALUES (?, ?, ?, ?)',
    favorite.provider,
    favorite.recipe_id,
    favorite.recipe_data ?? null,
    ts
  );
  const created = await getByRecipe(favorite.provider, favorite.recipe_id);
  if (!created) throw new Error('Failed to read created favorite');
  return created;
}

export async function updateRecipeData(
  id: number,
  recipe_data: string
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    'UPDATE favorites SET recipe_data = ? WHERE id = ?',
    recipe_data,
    id
  );
}

export async function deleteFavorite(id: number): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM favorites WHERE id = ?', id);
}

export async function deleteByRecipe(
  provider: string,
  recipe_id: string
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    'DELETE FROM favorites WHERE provider = ? AND recipe_id = ?',
    provider,
    recipe_id
  );
}

