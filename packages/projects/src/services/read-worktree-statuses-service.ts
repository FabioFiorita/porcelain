import type {
  ReadWorktreeStatusesInput,
  ReadWorktreeStatusesResult,
} from '../models/read-worktree-statuses.ts';
import type { WorktreeStatusStore } from '../ports/worktree-status-store.ts';

export class ReadWorktreeStatusesService {
  private readonly worktreeStatus: WorktreeStatusStore;

  constructor(worktreeStatus: WorktreeStatusStore) {
    this.worktreeStatus = worktreeStatus;
  }

  execute(input: ReadWorktreeStatusesInput): ReadWorktreeStatusesResult {
    return this.worktreeStatus.status({
      worktreeIds: input.listings.flatMap((listing) =>
        listing.worktrees.map((worktree) => worktree.id),
      ),
    });
  }
}
