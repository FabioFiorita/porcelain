import type {
  FileChange,
  TrackedComparison,
  UnmergedComparison,
} from '@porcelain/changes/models';

export function modified(
  scope: 'staged' | 'unstaged',
  path: string,
  newOid?: string,
): TrackedComparison {
  return {
    scope,
    kind: 'modified',
    oldPath: path,
    newPath: path,
    oldMode: '100644',
    newMode: '100644',
    oldOid: '8a6929205fe52d1251aee0bbafe362ef543d4d35',
    newOid,
    supported: true,
  };
}

export function unmerged(path: string): UnmergedComparison {
  return {
    scope: 'unmerged',
    path,
    conflict: 'both-modified',
    modes: ['100644', '100644', '100644', '100644'],
    oids: ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40)],
  };
}

export function fileChange(
  path: string,
  comparisons: FileChange['comparisons'],
  fingerprint?: string,
): FileChange {
  return { path, fingerprint, comparisons };
}
