import { NoWorktreeAtPathError } from '../errors/no-worktree-at-path-error.ts';
import type {
  ResolveWorktreeByPathInput,
  ResolveWorktreeByPathResult,
} from '../models/worktree-path.ts';

function absolute(path: string): string | undefined {
  if (!path.startsWith('/') || path.includes('\0')) return undefined;
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}`;
}

function contains(root: string, path: string): boolean {
  return path === root || path.startsWith(root === '/' ? root : `${root}/`);
}

export class ResolveWorktreeByPathService {
  execute(input: ResolveWorktreeByPathInput): ResolveWorktreeByPathResult {
    const target = absolute(input.path);
    const containing = input.listings
      .flatMap((listing) => listing.worktrees)
      .map((worktree) => ({ id: worktree.id, root: absolute(worktree.path) }))
      .filter(
        (worktree): worktree is { id: string; root: string } =>
          target !== undefined &&
          worktree.root !== undefined &&
          contains(worktree.root, target),
      )
      .sort((left, right) => right.root.length - left.root.length);
    const selected = containing[0];
    if (selected === undefined) throw new NoWorktreeAtPathError();
    return { worktreeId: selected.id };
  }
}
