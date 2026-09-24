import type { GitChange, GitOrdinaryChange } from '@porcelain/git/inspection';
import type {
  ChangeComparison,
  ConflictKind,
  TrackedComparison,
} from '@porcelain/kernel/models';

const conflicts = {
  DD: 'both-deleted',
  AU: 'added-by-us',
  UD: 'deleted-by-them',
  UA: 'added-by-them',
  DU: 'deleted-by-us',
  AA: 'both-added',
  UU: 'both-modified',
} as const satisfies Record<string, ConflictKind>;

export function fromGitChange(change: GitChange): ChangeComparison {
  if (change.scope === 'untracked')
    return { scope: 'untracked', path: change.path };
  if (change.scope === 'unmerged')
    return {
      scope: 'unmerged',
      path: change.path,
      conflict: conflicts[change.conflict],
      modes: change.modes,
      oids: change.oids,
    };
  return {
    scope: change.scope,
    kind: change.kind,
    oldPath: change.oldPath ?? undefined,
    newPath: change.newPath ?? undefined,
    oldMode: change.oldMode,
    newMode: change.newMode,
    oldOid: change.oldOid ?? undefined,
    newOid: change.newOid ?? undefined,
    supported: change.supported,
  };
}

export function toGitChange(comparison: TrackedComparison): GitOrdinaryChange {
  return {
    scope: comparison.scope,
    kind: comparison.kind,
    oldPath: comparison.oldPath ?? null,
    newPath: comparison.newPath ?? null,
    oldMode: comparison.oldMode,
    newMode: comparison.newMode,
    oldOid: comparison.oldOid ?? null,
    newOid: comparison.newOid ?? null,
    supported: comparison.supported,
  };
}
