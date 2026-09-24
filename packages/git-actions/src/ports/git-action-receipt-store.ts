import type {
  FinishedGitAction,
  GitActionReceipt,
} from '../models/git-action-receipt.ts';

export interface GitActionReceiptStore {
  read(input: { requestId: string }): GitActionReceipt | undefined;
  insert(input: GitActionReceipt): void;
  save(input: GitActionReceipt): void;
  running(): GitActionReceipt[];
  latestInterrupted(input: {
    worktreeId: string;
  }): GitActionReceipt | undefined;
  finished(): FinishedGitAction[];
  remove(input: { requestIds: string[] }): void;
}
