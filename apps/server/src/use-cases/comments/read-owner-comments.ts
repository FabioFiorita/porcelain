import { Context, Effect, Layer } from 'effect';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { FindWorktreeForPathService } from '@porcelain/projects/services';
import type {
  CommentsResponse,
  OwnerCommentsQuery,
} from '@porcelain/contracts/comments';
import { ReadInventoryUseCasePort } from '../../ports/read-inventory-use-case-port.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { ListCommentsUseCasePort } from '../../ports/list-comments-use-case-port.ts';

export class ReadOwnerCommentsUseCase extends Context.Service<
  ReadOwnerCommentsUseCase,
  {
    readonly execute: (
      input: OwnerCommentsQuery,
    ) => Effect.Effect<
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
      const find = yield* FindWorktreeForPathService;
      return {
        execute: Effect.fn('ReadOwnerCommentsUseCase.execute')(
          function* (input) {
            const report = yield* inventory.execute().pipe(Effect.orDie);
            const worktreeId = yield* find.execute({
              worktrees: report.projects.flatMap(
                (project) => project.worktrees,
              ),
              path: input.path,
            });
            return yield* comments.execute({ worktreeId });
          },
        ),
      };
    }),
  );
}
