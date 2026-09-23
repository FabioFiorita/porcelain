import type {
  GitActionReceiptStore,
  GitActionRetentionStore,
  InterruptedGitActionStore,
  RunningGitActionStore,
} from '@porcelain/git-actions/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { GitActionRepository } from './git-action-repository.ts';

export function createGitActionStore(
  session: StorageSession,
): GitActionReceiptStore &
  RunningGitActionStore &
  InterruptedGitActionStore &
  GitActionRetentionStore {
  return new GitActionRepository(databaseOf(session));
}
