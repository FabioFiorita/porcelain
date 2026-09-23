import type { GitActionReceipt } from '../models/git-action-receipt.ts';

export interface GitActionReceiptStore {
  read(requestId: string): GitActionReceipt | undefined;
  insert(receipt: GitActionReceipt): void;
  save(receipt: GitActionReceipt): void;
}
