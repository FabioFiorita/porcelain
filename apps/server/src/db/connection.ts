import { mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { InvalidDataDirectoryError } from './errors/invalid-data-directory-error.ts';
import { UnsupportedDatabaseVersionError } from './errors/unsupported-database-version-error.ts';
import { migrateDatabase } from './migrate.ts';

export function openDatabase(dataDirectory: string) {
  if (!isAbsolute(dataDirectory)) throw new InvalidDataDirectoryError();
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const database = new Database(join(dataDirectory, 'inventory.sqlite'));
  const db = drizzle({ client: database });
  try {
    const version = database.pragma('user_version', { simple: true });
    if (version !== 0 && version !== 1 && version !== 2)
      throw new UnsupportedDatabaseVersionError(version);
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
