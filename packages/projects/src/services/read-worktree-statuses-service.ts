import type { ReadWorktreeStatusesInput } from '../models/inventory-operations.ts';
import type { WorktreeStatuses } from '../models/worktree-status.ts';
import type { WorktreeStatusStore } from '../ports/worktree-status-store.ts';

export class ReadWorktreeStatusesService {
  private readonly worktreeStatusStore: WorktreeStatusStore;

  constructor(worktreeStatusStore: WorktreeStatusStore) {
    this.worktreeStatusStore = worktreeStatusStore;
  }

  execute(input: ReadWorktreeStatusesInput): WorktreeStatuses {
    return this.worktreeStatusStore.status(
      input.listings.flatMap((listing) =>
        listing.worktrees.map((worktree) => worktree.id),
      ),
    );
  }
}
