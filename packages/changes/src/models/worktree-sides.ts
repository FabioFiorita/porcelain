import type {
  ChangeComparison,
  WorktreeEntry,
  WorktreeSide,
} from './change.ts';

export function sidePaths(changes: readonly ChangeComparison[]) {
  const wanted = new Map<string, boolean>();
  for (const change of changes) {
    if (change.scope === 'untracked') wanted.set(change.path, false);
    if (change.scope === 'unmerged') wanted.set(change.path, false);
    if (change.scope !== 'unstaged' || change.kind === 'deleted') continue;
    if (change.newPath) wanted.set(change.newPath, change.newMode === '160000');
  }
  return {
    submodules: [...wanted].flatMap(([path, gitlink]) =>
      gitlink ? [path] : [],
    ),
    ordinary: [...wanted].flatMap(([path, gitlink]) => (gitlink ? [] : [path])),
  };
}

export function observedSides(
  submodules: readonly string[],
  ordinary: readonly string[],
  entries: ReadonlyMap<string, WorktreeEntry>,
  heads: ReadonlyMap<string, string>,
): { sides: Map<string, WorktreeSide>; stamps: Map<string, string> } {
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
