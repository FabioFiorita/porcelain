import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { UnsupportedDatabaseVersionError } from './errors/unsupported-database-version-error.ts';

const migrationConfig = {
  migrationsFolder: fileURLToPath(new URL('../../drizzle/', import.meta.url)),
};

// Drizzle applies migrations after the latest recorded timestamp. Check the full
// prefix first so newer or divergent histories cannot silently skip our schema.
export function assertMigrationHistory(database: Database.Database) {
  const tables = database
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all();
  if (!tables.some((table) => table.name === '__drizzle_migrations')) {
    if (
      tables.length > 0 ||
      database.pragma('user_version', { simple: true }) !== 0
    )
      throw new UnsupportedDatabaseVersionError('untracked schema');
    return;
  }
  const applied = database
    .prepare<[], { hash: string; created_at: number }>(
      'SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at',
    )
    .all();
  const shipped = readMigrationFiles(migrationConfig);
  if (
    (applied.length === 0 && tables.length > 1) ||
    applied.some((entry, index) => {
      const migration = shipped[index];
      return (
        !migration ||
        entry.hash !== migration.hash ||
        entry.created_at !== migration.folderMillis
      );
    })
  ) {
    throw new UnsupportedDatabaseVersionError('incompatible migration history');
  }
}

export function migrateDatabase(db: BetterSQLite3Database) {
  migrate(db, migrationConfig);
}
