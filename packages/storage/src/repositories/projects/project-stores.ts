import type {
  FilePreferenceStore,
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { SqliteFilePreferenceStore } from './sqlite-file-preference-store.ts';
import { SqliteInventoryStore } from './sqlite-inventory-store.ts';
import { SqliteWorktreePresenceStore } from './sqlite-worktree-presence-store.ts';

export function createInventoryStore(session: StorageSession): InventoryStore {
  return new SqliteInventoryStore(databaseOf(session));
}

export function createFilePreferenceStore(
  session: StorageSession,
): FilePreferenceStore {
  return new SqliteFilePreferenceStore(databaseOf(session));
}

export function createWorktreePresenceStore(
  session: StorageSession,
): WorktreePresenceStore {
  return new SqliteWorktreePresenceStore(databaseOf(session));
}
