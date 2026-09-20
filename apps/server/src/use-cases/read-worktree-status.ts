import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveCheckoutSession } from './resolve-inspection-worktree.ts';

export class ReadWorktreeStatus {
  private readonly store: InventoryStore;
  private readonly git: InspectionFactory;

  constructor(store: InventoryStore, git: InspectionFactory) {
    this.store = store;
    this.git = git;
  }

  async execute(worktreeId: string, session: GitSession, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const { environmentId, checkout } = resolveCheckoutSession(
      this.store,
      session,
      worktreeId,
    );
    const status = await this.git(checkout).readStatus(signal);
    signal?.throwIfAborted();
    return { environmentId, worktreeId, status };
  }
}
