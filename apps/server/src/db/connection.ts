import { channel } from 'node:diagnostics_channel';
import { mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { deriveWorktreeId } from '../models/worktree-id.ts';
import { InvalidDataDirectoryError } from './errors/invalid-data-directory-error.ts';
import { assertMigrationHistory, migrateDatabase } from './migrate.ts';

/**
 * Each executed statement, for development tooling. The trace hook costs a
 * string conversion per statement, so it is installed only when something
 * already subscribes when the database opens.
 */
const sqlChannel = channel('porcelain:sql');

export type SqlEvent = { sql: string };

export function openDatabase(dataDirectory: string) {
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
    // Migration 0004 derives worktree ids in SQL. Registering the derivation
    // here is what lets that migration rewrite every column and JSON payload
    // inside its own transaction, rather than recording a schema change and
    // then rewriting ids in a second pass that a crash could skip.
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
  return { db, close: () => database.close() };
}
