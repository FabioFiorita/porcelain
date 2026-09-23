import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

const sessionBrand = Symbol('StorageSession');
const databases = new WeakMap<StorageSession, BetterSQLite3Database>();

export type StorageSession = {
  readonly [sessionBrand]: true;
  close(): void;
};

export function createSession(
  database: BetterSQLite3Database,
  close: () => void,
): StorageSession {
  const session: StorageSession = { [sessionBrand]: true, close };
  databases.set(session, database);
  return session;
}

export function databaseOf(session: StorageSession): BetterSQLite3Database {
  const database = databases.get(session);
  if (!database) throw new TypeError('Unknown storage session');
  return database;
}
