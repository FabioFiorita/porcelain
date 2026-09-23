import { createHash } from 'node:crypto';
import type { ChangeComparison, WorktreeSide } from './change.ts';

export function fingerprintChange(
  path: string,
  comparisons: readonly ChangeComparison[],
  worktree: (path: string) => WorktreeSide | undefined,
): string | undefined {
  const sides = comparisons.map((comparison) => side(comparison, worktree));
  if (sides.some((entry) => entry === undefined)) return undefined;
  return createHash('sha256')
    .update(JSON.stringify({ path, sides }))
    .digest('hex');
}

function side(
  comparison: ChangeComparison,
  worktree: (path: string) => WorktreeSide | undefined,
): unknown {
  if (comparison.scope === 'unmerged') {
    const observed = worktree(comparison.path);
    return {
      scope: 'unmerged',
      path: comparison.path,
      conflict: comparison.conflict,
      modes: comparison.modes,
      oids: comparison.oids,
      worktree: workingSide(observed) ?? { missing: true },
    };
  }
  if (comparison.scope === 'untracked') {
    const observed = worktree(comparison.path);
    const working = workingSide(observed);
    if (working === undefined) return undefined;
    return { scope: 'untracked', path: comparison.path, ...working };
  }
  const base = {
    scope: comparison.scope,
    kind: comparison.kind,
    oldPath: comparison.oldPath,
    newPath: comparison.newPath,
    oldMode: comparison.oldMode,
    newMode: comparison.newMode,
    oldOid: comparison.oldOid,
  };
  if (comparison.scope === 'staged')
    return comparison.newOid == undefined && comparison.kind !== 'deleted'
      ? undefined
      : { ...base, newOid: comparison.newOid };
  if (comparison.kind === 'deleted')
    return { ...base, newOid: comparison.newOid };
  const observed = comparison.newPath
    ? worktree(comparison.newPath)
    : undefined;
  const working = workingSide(observed);
  if (working === undefined) return undefined;
  return { ...base, ...working };
}

function workingSide(observed: WorktreeSide | undefined) {
  if (!observed) return undefined;
  if (observed.symlink !== undefined) return { symlink: observed.symlink };
  if (observed.submodule !== undefined)
    return { submodule: observed.submodule };
  if (observed.digest !== undefined) return { digest: observed.digest };
  return undefined;
}

export function logicalPath(change: ChangeComparison) {
  if ('path' in change) return change.path;
  return change.newPath ?? change.oldPath ?? '';
}

const scopeOrder = {
  staged: 0,
  unstaged: 1,
  untracked: 2,
  unmerged: 3,
} as const;

export function orderComparisons(comparisons: readonly ChangeComparison[]) {
  return comparisons.toSorted((left, right) => {
    const difference = scopeOrder[left.scope] - scopeOrder[right.scope];
    if (difference !== 0) return difference;
    return logicalPath(left).localeCompare(logicalPath(right));
  });
}
