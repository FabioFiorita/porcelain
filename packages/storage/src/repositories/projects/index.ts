import type {
  FilePreferenceStore,
  InventoryStore,
  ProjectRemovalStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { SqliteEnvironmentIdentityStore } from '../access/sqlite-environment-identity-store.ts';
import { SqliteFilePreferenceStore } from './sqlite-file-preference-store.ts';
import { SqliteInventoryStore } from './sqlite-inventory-store.ts';
import { SqliteProjectRemovalStore } from './sqlite-project-removal-store.ts';
import { SqliteWorktreePresenceStore } from './sqlite-worktree-presence-store.ts';

export function createInventoryStore(session: StorageSession): InventoryStore {
  const db = databaseOf(session);
  return new SqliteInventoryStore(db, new SqliteEnvironmentIdentityStore(db));
}

export function createProjectRemovalStore(
  session: StorageSession,
): ProjectRemovalStore {
  return new SqliteProjectRemovalStore(databaseOf(session));
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
