import { Context, Effect, Layer } from 'effect';
import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { ReadEnvironmentService } from '@porcelain/access/services';
import { ReadWorktreeSummaryService } from '@porcelain/changes/services';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { ReadWorktreeSummaryResponse } from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
export class ReadWorktreeSummaryUseCase extends Context.Service<
  ReadWorktreeSummaryUseCase,
  {
    readonly execute: (
      input: WorktreeParams,
    ) => Effect.Effect<
      ReadWorktreeSummaryResponse,
      WorktreeAccessFailure | GitIoFailure | MissingEnvironmentIdentityError
    >;
  }
>()('@porcelain/server/ReadWorktreeSummaryUseCase') {
  static readonly layer = Layer.effect(
    ReadWorktreeSummaryUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const summary = yield* ReadWorktreeSummaryService;
      const environment = yield* ReadEnvironmentService;
      return {
        execute: Effect.fn('ReadWorktreeSummaryUseCase.execute')(
          (input: WorktreeParams) =>
            access.read(input.worktreeId, () =>
              Effect.gen(function* () {
                return {
                  environmentId: (yield* environment.execute()).environmentId,
                  worktreeId: input.worktreeId,
                  ...(yield* summary.execute(input)),
                };
              }),
            ),
        ),
      };
    }),
  );
}
