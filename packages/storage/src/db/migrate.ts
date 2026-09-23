import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { UnsupportedDatabaseVersionError } from '../models/unsupported-database-version-error.ts';

const migrationsFolder = fileURLToPath(
  new URL('../../drizzle/', import.meta.url),
);

function appliedHashes(database: Database.Database): string[] {
  return database
    .prepare<[], { hash: string }>(
      'SELECT hash FROM __drizzle_migrations ORDER BY rowid',
    )
    .all()
    .map((entry) => entry.hash);
}

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
  const applied = appliedHashes(database);
  const shipped = readMigrationFiles({ migrationsFolder });
  if (
    (applied.length === 0 && tables.length > 1) ||
    applied.some((hash, index) => hash !== shipped[index]?.hash)
  )
    throw new UnsupportedDatabaseVersionError('incompatible migration history');
}

export function migrateDatabase(database: Database.Database) {
  const shipped = readMigrationFiles({ migrationsFolder });
  database
    .transaction(() => {
      database.exec(
        'CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
      );
      const record = database.prepare<[string, number]>(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      );
      for (const migration of shipped.slice(appliedHashes(database).length)) {
        for (const statement of migration.sql) database.exec(statement);
        record.run(migration.hash, migration.folderMillis);
      }
      if (database.prepare('PRAGMA foreign_key_check').all().length > 0)
        throw new UnsupportedDatabaseVersionError('orphaned rows');
    })
    .immediate();
}
