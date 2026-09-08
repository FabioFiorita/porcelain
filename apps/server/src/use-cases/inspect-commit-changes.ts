import type { CommitChangesRequest } from '../git/dtos/commit-history.ts';
import type { CommitReaderFactory } from '../git/interfaces/commit-reader.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveHistoryCheckout } from './resolve-history-checkout.ts';

export class InspectCommitChanges {
  private readonly store: InventoryStore;
  private readonly git: CommitReaderFactory;
  constructor(store: InventoryStore, git: CommitReaderFactory) {
    this.store = store;
    this.git = git;
  }
  async execute(
    worktreeId: string,
    request: CommitChangesRequest,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    return this.git(
      resolveHistoryCheckout(this.store, worktreeId),
    ).inspectCommitChanges(request, signal);
  }
}
