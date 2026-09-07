import { mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { InvalidDataDirectoryError } from './errors/invalid-data-directory-error.ts';
import { assertMigrationHistory, migrateDatabase } from './migrate.ts';

export function openDatabase(dataDirectory: string) {
  if (!isAbsolute(dataDirectory)) throw new InvalidDataDirectoryError();
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const database = new Database(join(dataDirectory, 'inventory.sqlite'));
  const db = drizzle({ client: database });
  try {
    assertMigrationHistory(database);
    database.exec(
      'PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;',
    );
    migrateDatabase(db);
  } catch (error) {
    database.close();
    throw error;
  }
  return { db, close: () => database.close() };
}
