import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 6;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const version = row?.user_version ?? 0;

    if (version < 1) {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS pantry_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          barcode TEXT,
          quantity REAL,
          unit TEXT,
          added_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recipe_id TEXT NOT NULL UNIQUE,
          recipe_data TEXT,
          added_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS product_cache (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          cached_at INTEGER NOT NULL,
          ttl_seconds INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS recipe_cache (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          cached_at INTEGER NOT NULL,
          ttl_seconds INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at INTEGER NOT NULL
        );
      `);
    }

    if (version < 2) {
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(pantry_items)');
      const names = new Set(columns.map((c) => c.name));
      if (!names.has('normalized_name')) {
        await db.runAsync('ALTER TABLE pantry_items ADD COLUMN normalized_name TEXT');
        await db.runAsync(
          `UPDATE pantry_items SET normalized_name = LOWER(TRIM(name)) WHERE normalized_name IS NULL`
        );
      }
      if (!names.has('category')) {
        await db.runAsync('ALTER TABLE pantry_items ADD COLUMN category TEXT');
      }
      if (!names.has('best_before')) {
        await db.runAsync('ALTER TABLE pantry_items ADD COLUMN best_before INTEGER');
      }
    }

    if (version < 3) {
      const favColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(favorites)');
      const favNames = new Set(favColumns.map((c) => c.name));
      if (!favNames.has('provider')) {
        await db.execAsync(`
          CREATE TABLE favorites_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL DEFAULT 'web',
            recipe_id TEXT NOT NULL,
            recipe_data TEXT,
            added_at INTEGER NOT NULL,
            UNIQUE(provider, recipe_id)
          );
          INSERT INTO favorites_new (id, provider, recipe_id, recipe_data, added_at)
          SELECT id, 'web', recipe_id, recipe_data, added_at FROM favorites;
          DROP TABLE favorites;
          ALTER TABLE favorites_new RENAME TO favorites;
        `);
      }
    }

    if (version < 4) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS saved_web_recipes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          source_url TEXT NOT NULL,
          image_url TEXT,
          ingredient_query TEXT,
          saved_at INTEGER NOT NULL
        );
      `);
    }

    if (version < 5) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS generated_recipes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ingredient_cache_key TEXT NOT NULL,
          title TEXT NOT NULL,
          ingredients_json TEXT NOT NULL,
          steps_json TEXT NOT NULL,
          servings INTEGER,
          ready_in_minutes INTEGER,
          image_path TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_generated_recipes_ingredient_key ON generated_recipes(ingredient_cache_key);
      `);
    }

    if (version < 6) {
      await db.runAsync(
        `UPDATE favorites SET provider = 'web' WHERE provider NOT IN ('web', 'generated')`
      );
    }

    await db.runAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}
