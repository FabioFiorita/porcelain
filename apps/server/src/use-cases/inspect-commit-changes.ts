import type { CommitChangesRequest } from '@porcelain/git/dtos/commit-history';
import type { CommitReaderFactory } from '@porcelain/git/interfaces/commit-reader';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveHistoryCheckout } from './resolve-history-checkout.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class InspectCommitChanges {
  private readonly store: InventoryStore;
  private readonly worktrees: ResolveWorktree;
  private readonly git: CommitReaderFactory;
  constructor(
    store: InventoryStore,
    worktrees: ResolveWorktree,
    git: CommitReaderFactory,
  ) {
    this.store = store;
    this.worktrees = worktrees;
    this.git = git;
  }
  async execute(
    worktreeId: string,
    request: CommitChangesRequest,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    return this.git(
      await resolveHistoryCheckout(
        this.worktrees,
        this.store,
        worktreeId,
        signal,
      ),
    ).inspectCommitChanges(request, signal);
  }
}
