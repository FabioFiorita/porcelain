import { Context, Effect, Layer } from 'effect';
import type { GitIoFailure } from '@porcelain/git/errors';
import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { CommentsResponse } from '@porcelain/contracts/comments';
import { ReadInventoryUseCasePort } from '../../ports/read-inventory-use-case-port.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { ListCommentsUseCasePort } from '../../ports/list-comments-use-case-port.ts';

export class ReadOwnerCommentsUseCase extends Context.Service<
  ReadOwnerCommentsUseCase,
  {
    readonly execute: (input: {
      readonly path: string;
    }) => Effect.Effect<
      CommentsResponse,
      WorktreeAccessFailure | GitIoFailure | WorktreeNotFoundError
    >;
  }
>()('@porcelain/server/ReadOwnerCommentsUseCase') {
  static readonly layer = Layer.effect(
    ReadOwnerCommentsUseCase,
    Effect.gen(function* () {
      const inventory = yield* ReadInventoryUseCasePort;
      const comments = yield* ListCommentsUseCasePort;
      return {
        execute: Effect.fn('ReadOwnerCommentsUseCase.execute')(
          function* (input) {
            const report = yield* inventory.execute().pipe(Effect.orDie);
            const worktree = report.projects
              .flatMap((project) => project.worktrees)
              .filter(
                (candidate) =>
                  input.path === candidate.path ||
                  input.path.startsWith(
                    `${candidate.path.replace(/\/+$/, '')}/`,
                  ),
              )
              .sort((a, b) => b.path.length - a.path.length)[0];
            if (!worktree) return yield* new WorktreeNotFoundError();
            return yield* comments.execute({ worktreeId: worktree.id });
          },
        ),
      };
    }),
  );
}
