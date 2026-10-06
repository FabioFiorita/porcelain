import { Effect, Context, Layer } from 'effect';
import {
  type DismissInterruptedGitActionParams,
  type DismissInterruptedGitActionResponse,
} from '@porcelain/contracts/git-actions';
import { DismissInterruptedGitActionService } from '@porcelain/git-actions/services';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class DismissInterruptedGitActionUseCase extends Context.Service<
  DismissInterruptedGitActionUseCase,
  {
    readonly execute: (
      input: DismissInterruptedGitActionParams,
    ) => Effect.Effect<
      DismissInterruptedGitActionResponse,
      | Effect.Error<ReturnType<CheckWorktreeUseCasePort['execute']>>
      | Effect.Error<
          ReturnType<
            Context.Service.Shape<
              typeof DismissInterruptedGitActionService
            >['execute']
          >
        >
    >;
  }
>()('@porcelain/server/DismissInterruptedGitActionUseCase') {
  static readonly layer = Layer.effect(
    DismissInterruptedGitActionUseCase,
    Effect.gen(function* () {
      const checkWorktreeCapability = yield* CheckWorktreeUseCasePort;
      const dismissInterruptedGitActionCapability =
        yield* DismissInterruptedGitActionService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('DismissInterruptedGitActionUseCase.execute')(
          function* (
            input: DismissInterruptedGitActionParams,
          ): Effect.fn.Return<
            DismissInterruptedGitActionResponse,
            | Effect.Error<ReturnType<CheckWorktreeUseCasePort['execute']>>
            | Effect.Error<
                ReturnType<
                  Context.Service.Shape<
                    typeof DismissInterruptedGitActionService
                  >['execute']
                >
              >
          > {
            const worktree = yield* checkWorktreeCapability.execute({
              worktreeId: input.worktreeId,
              requireAvailableProject: false,
            });
            return yield* lanesCapability
              .commit(
                laneKeysCapability.receipts(worktree),
                () =>
                  Effect.uninterruptible(
                    dismissInterruptedGitActionCapability.execute({
                      projectId: worktree.projectId,
                      worktreeId: worktree.id,
                      requestId: input.requestId,
                    }),
                  ),
                (result) =>
                  Effect.gen(function* () {
                    if (result.kind === 'dismissed')
                      yield* eventsCapability.gitActionChanged(result.receipt);
                  }),
              )
              .pipe(Effect.as({ dismissed: true as const }));
          },
        ),
      };
    }),
  );
}
