import type { GitActionReceipt } from '../models/git-action-receipt.ts';

export interface InterruptedGitActionStore {
  latestUndismissed(worktreeId: string): GitActionReceipt | undefined;
}
