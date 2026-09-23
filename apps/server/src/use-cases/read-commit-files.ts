import type {
  CommitDiffsRequest,
  CommitFilesRequest,
} from '@porcelain/git/dtos/commit-history';
import type { CommitReaderFactory } from '@porcelain/git/interfaces/commit-reader';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveHistoryCheckout } from './resolve-history-checkout.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class ReadCommitFiles {
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
  private async reader(worktreeId: string, signal?: AbortSignal) {
    return this.git(
      await resolveHistoryCheckout(
        this.worktrees,
        this.store,
        worktreeId,
        signal,
      ),
    );
  }
  async files(
    worktreeId: string,
    request: CommitFilesRequest,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    return (await this.reader(worktreeId, signal)).readCommitFiles(
      request,
      signal,
    );
  }
  async diffs(
    worktreeId: string,
    request: CommitDiffsRequest,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    return (await this.reader(worktreeId, signal)).readCommitDiffs(
      request,
      signal,
    );
  }
}
