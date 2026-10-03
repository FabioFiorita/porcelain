import type { ProjectWorktrees } from '../models/project-worktrees.ts';
import { absolutePath, containsPath } from './worktree-path.ts';

export function worktreeAtPath(
  path: string,
  listings: readonly ProjectWorktrees[],
): string | undefined {
  const target = absolutePath(path);
  if (target === undefined) return undefined;
  return listings
    .flatMap((listing) => listing.worktrees)
    .flatMap((worktree) => {
      const root = absolutePath(worktree.path);
      return root !== undefined && containsPath(root, target)
        ? [{ id: worktree.id, root }]
        : [];
    })
    .sort((left, right) => right.root.length - left.root.length)[0]?.id;
}
