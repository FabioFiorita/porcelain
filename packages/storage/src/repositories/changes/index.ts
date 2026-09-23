import type { WorktreeStatusStore } from '@porcelain/changes/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { WorktreeStatusRepository } from './worktree-status-repository.ts';

export function createWorktreeStatusStore(
  session: StorageSession,
): WorktreeStatusStore {
  return new WorktreeStatusRepository(databaseOf(session));
}
