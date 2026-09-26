import type { ProjectWorktrees } from '../models/project-worktrees.ts';

function shown(listings: readonly ProjectWorktrees[]): string {
  return JSON.stringify(
    listings.map((listing) => ({
      projectId: listing.projectId,
      available: listing.available,
      worktrees: listing.worktrees.map((worktree) => ({
        id: worktree.id,
        path: worktree.path,
        branch: worktree.branch,
        main: worktree.main,
        available: worktree.available,
      })),
    })),
  );
}

export function knownWorktreesChanged(
  before: readonly ProjectWorktrees[],
  after: readonly ProjectWorktrees[],
): boolean {
  return shown(before) !== shown(after);
}
