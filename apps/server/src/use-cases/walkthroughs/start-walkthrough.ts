import { Context, Effect, Layer } from 'effect';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { StartWalkthroughRequest } from '@porcelain/contracts/walkthroughs';
import type { WalkthroughRun } from '@porcelain/walkthroughs/models';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { WalkthroughFailedError } from '@porcelain/walkthroughs/errors';
import { QueueWalkthroughUseCasePort } from '../../ports/queue-walkthrough-use-case-port.ts';
export class StartWalkthroughUseCase extends Context.Service<
  StartWalkthroughUseCase,
  {
    readonly execute: (
      input: WorktreeParams & StartWalkthroughRequest,
    ) => Effect.Effect<
      WalkthroughRun,
      WorktreeAccessFailure | GitIoFailure | WalkthroughFailedError
    >;
  }
>()('@porcelain/server/StartWalkthroughUseCase') {
  static readonly layer = Layer.effect(
    StartWalkthroughUseCase,
    Effect.gen(function* () {
      const queue = yield* QueueWalkthroughUseCasePort;
      return {
        execute: Effect.fn('StartWalkthroughUseCase.execute')(
          (input: WorktreeParams & StartWalkthroughRequest) =>
            queue.execute(input),
        ),
      };
    }),
  );
}
