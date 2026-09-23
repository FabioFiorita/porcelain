import type { GitActionReceipt } from '../models/git-action-receipt.ts';

export interface RunningGitActionStore {
  running(): GitActionReceipt[];
}
