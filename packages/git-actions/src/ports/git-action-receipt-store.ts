import type { WorktreeKey } from '@porcelain/kernel/models';
import type {
  FinishedGitAction,
  GitActionReceipt,
  GitActionReceiptKey,
  GitActionReceiptRemoval,
} from '../models/git-action-receipt.ts';

export interface GitActionReceiptStore {
  read(input: GitActionReceiptKey): GitActionReceipt | undefined;
  insert(input: GitActionReceipt): void;
  save(input: GitActionReceipt): void;
  running(): GitActionReceipt[];
  latestInterrupted(input: WorktreeKey): GitActionReceipt | undefined;
  finished(): FinishedGitAction[];
  remove(input: GitActionReceiptRemoval): void;
}
