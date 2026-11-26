import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { Context, Effect, Layer } from 'effect';

type WorktreePath = { readonly id: string; readonly path: string };
type FindWorktreeInput = {
  readonly worktrees: readonly WorktreePath[];
  readonly path: string;
};

export class FindWorktreeForPathService extends Context.Service<
  FindWorktreeForPathService,
  {
    readonly execute: (
      input: FindWorktreeInput,
    ) => Effect.Effect<string, WorktreeNotFoundError>;
  }
>()('@porcelain/projects/FindWorktreeForPathService') {
  static readonly layer = Layer.succeed(FindWorktreeForPathService, {
    execute: Effect.fn('FindWorktreeForPathService.execute')(function* ({
      worktrees,
      path,
    }: FindWorktreeInput) {
      const worktree = worktrees
        .filter(
          (candidate) =>
            path === candidate.path ||
            path.startsWith(`${candidate.path.replace(/\/+$/, '')}/`),
        )
        .sort((left, right) => right.path.length - left.path.length)[0];
      if (worktree === undefined) return yield* new WorktreeNotFoundError();
      return worktree.id;
    }),
  });
}
