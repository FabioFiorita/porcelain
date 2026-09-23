import type { GitActionStore } from '@porcelain/git-actions/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { GitActionRepository } from './git-action-repository.ts';

export function createGitActionStore(session: StorageSession): GitActionStore {
  return new GitActionRepository(databaseOf(session));
}
