import { createHash } from 'node:crypto';
import type { GitChange } from '@porcelain/git/dtos/git-status';

export type WorktreeSide = {
  digest?: string | undefined;
  symlink?: string | undefined;
  submodule?: string | undefined;
};

export function fingerprintChange(
  path: string,
  comparisons: readonly GitChange[],
  worktree: (path: string) => WorktreeSide | undefined,
): string | null {
  const sides = comparisons.map((comparison) => side(comparison, worktree));
  if (sides.some((entry) => entry === null)) return null;
  return createHash('sha256')
    .update(JSON.stringify({ path, sides }))
    .digest('hex');
}

function side(
  comparison: GitChange,
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
    if (working === null) return null;
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
    return comparison.newOid === null && comparison.kind !== 'deleted'
      ? null
      : { ...base, newOid: comparison.newOid };
  if (comparison.kind === 'deleted') return { ...base, newOid: null };
  const observed = comparison.newPath
    ? worktree(comparison.newPath)
    : undefined;
  const working = workingSide(observed);
  if (working === null) return null;
  return { ...base, ...working };
}

function workingSide(observed: WorktreeSide | undefined) {
  if (!observed) return null;
  if (observed.symlink !== undefined) return { symlink: observed.symlink };
  if (observed.submodule !== undefined)
    return { submodule: observed.submodule };
  if (observed.digest !== undefined) return { digest: observed.digest };
  return null;
}
