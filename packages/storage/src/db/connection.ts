import { mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { InvalidDataDirectoryError } from '../models/invalid-data-directory-error.ts';
import { DATABASE_FILE } from './database-files.ts';
import { createEnvironmentIdentity } from './environment-identity.ts';
import { assertMigrationHistory, migrateDatabase } from './migrate.ts';
import { createSession, type StorageSession } from './session.ts';
import { worktreeIdV1 } from './worktree-id-v1.ts';

export function openStorageSession(dataDirectory: string): StorageSession {
  if (!isAbsolute(dataDirectory)) throw new InvalidDataDirectoryError();
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const database = new Database(join(dataDirectory, DATABASE_FILE));
  try {
    assertMigrationHistory(database);
    database.pragma('busy_timeout = 5000');
    database.pragma('journal_mode = WAL');
    database.function(
      'porcelain_worktree_id',
      { deterministic: true },
      (projectId: unknown, metadataIdentity: unknown) =>
        typeof projectId === 'string' && typeof metadataIdentity === 'string'
          ? worktreeIdV1(projectId, metadataIdentity)
          : null,
    );
    database.pragma('foreign_keys = OFF');
    migrateDatabase(database);
    database.pragma('foreign_keys = ON');
    const db = drizzle({ client: database });
    createEnvironmentIdentity(db);
    return createSession(db, () => database.close());
  } catch (error) {
    database.close();
    throw error;
  }
}
