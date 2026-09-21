import { createHash } from 'node:crypto';
import type { GitChange } from '@porcelain/git/dtos/git-status';

/**
 * What a reviewer is saying they read, in a form that cannot miss an edit.
 *
 * One fingerprint per path, over every comparison of it, because a file can be
 * staged and edited again: a fingerprint over one side would let the other be
 * marked unseen. Modes are in it too — `100644` to `100755` is a real change
 * that leaves the bytes alone.
 *
 * What each side is:
 *
 * - an index or HEAD object id, which Git printed in the status;
 * - for a working file, a digest of its bytes, read without following links;
 * - for a symlink, its literal target, never the content it points at;
 * - for a submodule, the recorded commit on each side. What changed *inside*
 *   it is not part of the parent's review, and the status deliberately does
 *   not look.
 *
 * `null` means "not markable": the content could not be established at all.
 * Binary files are not in that group — they have a digest like anything else,
 * and an image edit has to be reviewable.
 */
export type WorktreeSide = {
  /** A digest of the working file's bytes, when it could be read. */
  digest?: string | undefined;
  /** The literal target of a symlink, hashed instead of its content. */
  symlink?: string | undefined;
  /** Where a changed submodule currently points. */
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
  // The staged side is whole: Git recorded both objects.
  if (comparison.scope === 'staged')
    return comparison.newOid === null && comparison.kind !== 'deleted'
      ? null
      : { ...base, newOid: comparison.newOid };
  // The unstaged side ends at the working path, which the caller established.
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
