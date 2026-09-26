import type {
  ObservedSides,
  SidePaths,
  WorktreeEntry,
  WorktreeSide,
} from '../models/worktree-side.ts';

export function observedSides(
  paths: SidePaths,
  entries: ReadonlyMap<string, WorktreeEntry>,
  heads: ReadonlyMap<string, string>,
): ObservedSides {
  const sides = new Map<string, WorktreeSide>();
  const stamps = new Map<string, string>();
  for (const path of paths.submodules) {
    const head = heads.get(path);
    if (head) sides.set(path, { submodule: head });
  }
  for (const path of paths.files) {
    const entry = entries.get(path);
    if (entry?.kind === 'symlink') sides.set(path, { symlink: entry.target });
    if (entry?.kind === 'file') sides.set(path, { digest: entry.digest });
    if (entry?.kind === 'file' || entry?.kind === 'symlink')
      stamps.set(path, entry.stamp);
  }
  return { sides, stamps };
}
