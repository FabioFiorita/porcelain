import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { InspectionFactory } from '@porcelain/git/inspection';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveCheckoutSession } from './resolve-inspection-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class ReadWorktreeStatus {
  private readonly store: InventoryStore;
  private readonly worktrees: ResolveWorktree;
  private readonly git: InspectionFactory;

  constructor(
    store: InventoryStore,
    worktrees: ResolveWorktree,
    git: InspectionFactory,
  ) {
    this.store = store;
    this.worktrees = worktrees;
    this.git = git;
  }

  async execute(worktreeId: string, session: GitSession, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const { environmentId, checkout } = await resolveCheckoutSession(
      this.worktrees,
      this.store,
      session,
      worktreeId,
      signal,
    );
    const reader = this.git(checkout);
    const status = await reader.readStatus(signal);
    signal?.throwIfAborted();
    const details = await reader.readBranchDetails(
      status.branch?.name ?? null,
      status.headOid,
      signal,
    );
    signal?.throwIfAborted();
    return {
      environmentId,
      worktreeId,
      status: {
        ...status,
        headCommit: details.headCommit,
        ...(status.branch
          ? {
              branch: {
                ...status.branch,
                remoteName: details.remoteName,
                sourceRef: details.sourceRef,
                upstreamOid: details.upstreamOid,
                stashes: details.stashes,
                discarded: details.discarded,
              },
            }
          : {}),
      },
    };
  }
}
