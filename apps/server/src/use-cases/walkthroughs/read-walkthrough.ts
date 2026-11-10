import type { WorktreeParams } from '@porcelain/contracts/shared';
import { Context, Effect, Layer } from 'effect';
import { ReadWalkthroughService } from '@porcelain/walkthroughs/services';
import type { WalkthroughRun } from '@porcelain/walkthroughs/models';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '@porcelain/git/errors';
export class ReadWalkthroughUseCase extends Context.Service<
  ReadWalkthroughUseCase,
  {
    readonly execute: (input: WorktreeParams) => Effect.Effect<
      {
        walkthrough: WalkthroughRun | undefined;
        attempt: WalkthroughRun | undefined;
        outOfDate: boolean;
      },
      WorktreeAccessFailure | GitIoFailure
    >;
  }
>()('@porcelain/server/ReadWalkthroughUseCase') {
  static readonly layer = Layer.effect(
    ReadWalkthroughUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const store = yield* ReadWalkthroughService;
      return {
        execute: Effect.fn('ReadWalkthroughUseCase.execute')(function* (input) {
          return yield* access.read(input.worktreeId, () =>
            Effect.gen(function* () {
              const { walkthrough, attempt, outOfDate } =
                yield* store.execute(input);
              return { walkthrough, attempt, outOfDate };
            }),
          );
        }),
      };
    }),
  );
}
