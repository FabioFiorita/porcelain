import { fileURLToPath } from 'node:url';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export function migrateDatabase(db: BetterSQLite3Database) {
  migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../drizzle/', import.meta.url)),
  });
}
