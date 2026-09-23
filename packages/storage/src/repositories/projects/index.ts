import type {
  FilePreferenceStore,
  InventoryStore,
  ProjectRemovalStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { EnvironmentIdentityRepository } from '../access/environment-identity-repository.ts';
import { FilePreferenceRepository } from './file-preference-repository.ts';
import { InventoryRepository } from './inventory-repository.ts';
import { ProjectRemovalRepository } from './project-removal-repository.ts';
import { WorktreePresenceRepository } from './worktree-presence-repository.ts';

export function createInventoryStore(session: StorageSession): InventoryStore {
  const db = databaseOf(session);
  return new InventoryRepository(db, new EnvironmentIdentityRepository(db));
}

export function createProjectRemovalStore(
  session: StorageSession,
): ProjectRemovalStore {
  return new ProjectRemovalRepository(databaseOf(session));
}

export function createFilePreferenceStore(
  session: StorageSession,
): FilePreferenceStore {
  return new FilePreferenceRepository(databaseOf(session));
}

export function createWorktreePresenceStore(
  session: StorageSession,
): WorktreePresenceStore {
  return new WorktreePresenceRepository(databaseOf(session));
}
