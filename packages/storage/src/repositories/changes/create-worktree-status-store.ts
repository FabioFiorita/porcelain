import type { WorktreeStatusStore } from '@porcelain/projects/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { SqliteWorktreeStatusStore } from './sqlite-worktree-status-store.ts';

export function createWorktreeStatusStore(
  session: StorageSession,
): WorktreeStatusStore {
  return new SqliteWorktreeStatusStore(databaseOf(session));
}
