import { NoWorktreeAtPathError } from '../errors/no-worktree-at-path-error.ts';
import type {
  FindWorktreeByPathInput,
  FindWorktreeByPathResult,
} from '../models/find-worktree-by-path.ts';
import { absolutePath, containsPath } from '../rules/worktree-path.ts';

export class FindWorktreeByPathService {
  execute(input: FindWorktreeByPathInput): FindWorktreeByPathResult {
    const target = absolutePath(input.path);
    const containing = input.listings
      .flatMap((listing) => listing.worktrees)
      .map((worktree) => ({
        id: worktree.id,
        root: absolutePath(worktree.path),
      }))
      .filter(
        (worktree): worktree is { id: string; root: string } =>
          target !== undefined &&
          worktree.root !== undefined &&
          containsPath(worktree.root, target),
      )
      .sort((left, right) => right.root.length - left.root.length);
    const selected = containing[0];
    if (selected === undefined) throw new NoWorktreeAtPathError();
    return { worktreeId: selected.id };
  }
}
