import type { ListedWorktree } from '../models/listed-worktree.ts';
import type { ProjectWorktrees } from '../models/project-worktrees.ts';
import type {
  WorktreeActivityObservation,
  WorktreeActivityTarget,
} from '../models/worktree-activity.ts';

function sameCheckout(a: WorktreeActivityTarget, b: WorktreeActivityTarget) {
  return (
    a.id === b.id &&
    a.projectId === b.projectId &&
    a.path === b.path &&
    a.metadataIdentity === b.metadataIdentity
  );
}

function withActivity(
  worktree: ListedWorktree,
  uncommittedChangedAt: string | undefined,
): ListedWorktree {
  const { uncommittedChangedAt: _previous, ...rest } = worktree;
  return uncommittedChangedAt ? { ...rest, uncommittedChangedAt } : rest;
}

export function activityTargets(
  listings: readonly ProjectWorktrees[],
): WorktreeActivityTarget[] {
  return listings.flatMap((listing) =>
    listing.available
      ? listing.worktrees
          .filter((worktree) => worktree.available)
          .map(({ id, projectId, path, metadataIdentity }) => ({
            id,
            projectId,
            path,
            metadataIdentity,
          }))
      : [],
  );
}

export function carryWorktreeActivity(
  listed: readonly ListedWorktree[],
  previous: readonly ListedWorktree[],
): ListedWorktree[] {
  return listed.map((worktree) =>
    withActivity(
      worktree,
      previous.find((known) => sameCheckout(known, worktree))
        ?.uncommittedChangedAt,
    ),
  );
}

export function applyWorktreeActivity(
  worktrees: readonly ListedWorktree[],
  observations: readonly WorktreeActivityObservation[],
): ListedWorktree[] {
  return worktrees.map((worktree) => {
    const observed = observations.find((observation) =>
      sameCheckout(observation, worktree),
    )?.activity;
    if (observed === undefined || observed.kind === 'failed') return worktree;
    return withActivity(
      worktree,
      observed.kind === 'dated' ? observed.at : undefined,
    );
  });
}
