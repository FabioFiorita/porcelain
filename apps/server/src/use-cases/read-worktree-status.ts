import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
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

  /**
   * The status the action UI needs, which is the change list plus the remote
   * name, source ref and stashes only an action uses. Reading changes does not
   * come through here, so opening a worktree does not pay for those two extra
   * processes.
   */
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
    // Detached: there is no upstream to name and no action that wants one.
    if (!status.branch) return { environmentId, worktreeId, status };
    const details = await reader.readBranchDetails(status.branch.name, signal);
    signal?.throwIfAborted();
    return {
      environmentId,
      worktreeId,
      status: { ...status, branch: { ...status.branch, ...details } },
    };
  }
}
