import type { GitChange } from '@porcelain/git/inspection';
import type { InspectionReader } from '@porcelain/git/inspection';
import type { WorktreeFiles } from '../filesystem/interfaces/worktree-files.ts';
import type { WorktreeSide } from './fingerprint-change.ts';

export async function observeWorktreeSides(
  reader: InspectionReader,
  files: WorktreeFiles,
  root: string,
  changes: readonly GitChange[],
  signal?: AbortSignal,
): Promise<{ sides: Map<string, WorktreeSide>; stamps: Map<string, string> }> {
  const wanted = new Map<string, boolean>();
  for (const change of changes) {
    if (change.scope === 'untracked') wanted.set(change.path, false);
    if (change.scope === 'unmerged') wanted.set(change.path, false);
    if (change.scope !== 'unstaged' || change.kind === 'deleted') continue;
    if (change.newPath) wanted.set(change.newPath, change.newMode === '160000');
  }
  if (wanted.size === 0) return { sides: new Map(), stamps: new Map() };
  const submodules = [...wanted].flatMap(([path, gitlink]) =>
    gitlink ? [path] : [],
  );
  const ordinary = [...wanted].flatMap(([path, gitlink]) =>
    gitlink ? [] : [path],
  );
  const [entries, heads] = await Promise.all([
    files(root, ordinary),
    submodules.length > 0
      ? reader.readSubmoduleHeads(submodules, signal)
      : new Map<string, string>(),
  ]);
  signal?.throwIfAborted();
  const sides = new Map<string, WorktreeSide>();
  const stamps = new Map<string, string>();
  for (const path of submodules) {
    const head = heads.get(path);
    if (head) sides.set(path, { submodule: head });
  }
  for (const path of ordinary) {
    const entry = entries.get(path);
    if (entry?.kind === 'symlink') sides.set(path, { symlink: entry.target });
    else if (entry?.kind === 'file') sides.set(path, { digest: entry.digest });
    if (entry?.kind === 'file' || entry?.kind === 'symlink')
      stamps.set(path, entry.stamp);
  }
  return { sides, stamps };
}

export function logicalPath(change: GitChange) {
  if ('path' in change) return change.path;
  return change.newPath ?? change.oldPath ?? '';
}

const scopeOrder = {
  staged: 0,
  unstaged: 1,
  untracked: 2,
  unmerged: 3,
} as const;

export function orderComparisons(comparisons: readonly GitChange[]) {
  return comparisons.toSorted((left, right) => {
    const difference = scopeOrder[left.scope] - scopeOrder[right.scope];
    if (difference !== 0) return difference;
    return logicalPath(left).localeCompare(logicalPath(right));
  });
}
