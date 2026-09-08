import type { CommitPageRequest } from '@porcelain/git/dtos/commit-history';
import type { CommitReaderFactory } from '@porcelain/git/interfaces/commit-reader';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveHistoryCheckout } from './resolve-history-checkout.ts';

export class ListCommits {
  private readonly store: InventoryStore;
  private readonly git: CommitReaderFactory;
  constructor(store: InventoryStore, git: CommitReaderFactory) {
    this.store = store;
    this.git = git;
  }
  async execute(
    worktreeId: string,
    request: CommitPageRequest,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    return this.git(resolveHistoryCheckout(this.store, worktreeId)).listCommits(
      request,
      signal,
    );
  }
}
