import type {
  GitActionReceiptStore,
  GitActionRetentionStore,
  InterruptedGitActionStore,
  RunningGitActionStore,
} from '@porcelain/git-actions/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { SqliteGitActionReceiptStore } from './sqlite-git-action-receipt-store.ts';

export function createGitActionStore(
  session: StorageSession,
): GitActionReceiptStore &
  RunningGitActionStore &
  InterruptedGitActionStore &
  GitActionRetentionStore {
  return new SqliteGitActionReceiptStore(databaseOf(session));
}
