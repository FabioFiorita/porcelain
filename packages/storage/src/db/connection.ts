import { channel } from 'node:diagnostics_channel';
import { mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { deriveWorktreeId } from '@porcelain/projects/models';
import { InvalidDataDirectoryError } from '../models/invalid-data-directory-error.ts';
import { assertMigrationHistory, migrateDatabase } from './migrate.ts';
import { createSession } from './session.ts';

const sqlChannel = channel('porcelain:sql');

export type SqlEvent = { sql: string };

export function openStorageSession(dataDirectory: string) {
  if (!isAbsolute(dataDirectory)) throw new InvalidDataDirectoryError();
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const database = new Database(
    join(dataDirectory, 'inventory.sqlite'),
    sqlChannel.hasSubscribers
      ? {
          verbose: (sql) => {
            if (sqlChannel.hasSubscribers)
              sqlChannel.publish({ sql: String(sql) } satisfies SqlEvent);
          },
        }
      : {},
  );
  const db = drizzle({ client: database });
  try {
    assertMigrationHistory(database);
    database.exec(
      'PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;',
    );
    database.function(
      'porcelain_worktree_id',
      { deterministic: true },
      (projectId: unknown, metadataIdentity: unknown) =>
        typeof projectId === 'string' && typeof metadataIdentity === 'string'
          ? deriveWorktreeId(projectId, metadataIdentity)
          : null,
    );
    migrateDatabase(db);
  } catch (error) {
    database.close();
    throw error;
  }
  return createSession(db, () => database.close());
}
