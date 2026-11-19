import type { ProjectWorktrees } from '../models/project-worktrees.ts';

function shown(
  listings: readonly ProjectWorktrees[],
  activity: boolean,
): string {
  return JSON.stringify(
    listings.map((listing) => ({
      projectId: listing.projectId,
      available: listing.available,
      unavailableReason: listing.unavailableReason,
      worktrees: listing.worktrees.map((worktree) => ({
        id: worktree.id,
        path: worktree.path,
        branch: worktree.branch,
        main: worktree.main,
        available: worktree.available,
        headCommittedAt: worktree.headCommittedAt,
        ...(activity
          ? { uncommittedChangedAt: worktree.uncommittedChangedAt }
          : {}),
      })),
    })),
  );
}

export function knownWorktreesChange(
  before: readonly ProjectWorktrees[],
  after: readonly ProjectWorktrees[],
): 'inventory' | 'activity' | undefined {
  if (shown(before, false) !== shown(after, false)) return 'inventory';
  if (shown(before, true) !== shown(after, true)) return 'activity';
  return undefined;
}
