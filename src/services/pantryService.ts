import { getDb } from '../db';

export interface PantryItem {
  id: number;
  name: string;
  barcode: string | null;
  quantity: number | null;
  unit: string | null;
  added_at: number;
  updated_at: number;
  normalized_name: string | null;
  category: string | null;
  best_before: number | null;
}

export interface InsertPantryItem {
  name: string;
  normalized_name?: string | null;
  category?: string | null;
  barcode?: string | null;
  quantity?: number | null;
  unit?: string | null;
}

export interface UpdatePantryItem {
  name?: string;
  normalized_name?: string | null;
  category?: string | null;
  barcode?: string | null;
  quantity?: number | null;
  unit?: string | null;
  best_before?: number | null;
}

const MAX_INGREDIENTS_FOR_RECIPES = 15;

/** Build top 10–15 unique ingredient names from pantry (normalized_name or name) for recipe search. */
export function buildIngredientsFromPantry(items: PantryItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const name = (item.normalized_name || item.name || '').trim().toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= MAX_INGREDIENTS_FOR_RECIPES) break;
  }
  return out;
}

const now = () => Math.floor(Date.now() / 1000);

export async function getAll(): Promise<PantryItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<PantryItem>(
    'SELECT * FROM pantry_items ORDER BY updated_at DESC'
  );
  return rows;
}

export async function getById(id: number): Promise<PantryItem | null> {
  const db = getDb();
  const row = await db.getFirstAsync<PantryItem>('SELECT * FROM pantry_items WHERE id = ?', id);
  return row ?? null;
}

export async function create(item: InsertPantryItem): Promise<PantryItem> {
  const db = getDb();
  const ts = now();
  const result = await db.runAsync(
    `INSERT INTO pantry_items (name, barcode, quantity, unit, added_at, updated_at, normalized_name, category, best_before)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.name,
    item.barcode ?? null,
    item.quantity ?? null,
    item.unit ?? null,
    ts,
    ts,
    item.normalized_name ?? null,
    item.category ?? null,
    null
  );
  const created = await getById(Number(result.lastInsertRowId));
  if (!created) throw new Error('Failed to read created pantry item');
  return created;
}

export async function update(id: number, item: UpdatePantryItem): Promise<void> {
  const db = getDb();
  const existing = await getById(id);
  if (!existing) return;

  const name = item.name ?? existing.name;
  const barcode = item.barcode !== undefined ? item.barcode : existing.barcode;
  const quantity = item.quantity !== undefined ? item.quantity : existing.quantity;
  const unit = item.unit !== undefined ? item.unit : existing.unit;
  const normalized_name = item.normalized_name !== undefined ? item.normalized_name : existing.normalized_name;
  const category = item.category !== undefined ? item.category : existing.category;
  const best_before = item.best_before !== undefined ? item.best_before : existing.best_before;

  await db.runAsync(
    `UPDATE pantry_items SET name = ?, barcode = ?, quantity = ?, unit = ?, normalized_name = ?, category = ?, best_before = ?, updated_at = ? WHERE id = ?`,
    name,
    barcode,
    quantity,
    unit,
    normalized_name,
    category,
    best_before,
    now(),
    id
  );
}

export async function deleteItem(id: number): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM pantry_items WHERE id = ?', id);
}
