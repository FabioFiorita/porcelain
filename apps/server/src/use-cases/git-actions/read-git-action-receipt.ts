import { Effect, Context, Layer } from 'effect';
import {
  type ReadGitActionReceiptParams,
  type ReadGitActionReceiptResponse,
} from '@porcelain/contracts/git-actions';
import { ReadGitActionReceiptService } from '@porcelain/git-actions/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ReadGitActionReceiptUseCase extends Context.Service<
  ReadGitActionReceiptUseCase,
  {
    readonly execute: (
      input: ReadGitActionReceiptParams,
    ) => Effect.Effect<
      ReadGitActionReceiptResponse,
      | Effect.Error<ReturnType<CheckWorktreeUseCasePort['execute']>>
      | Effect.Error<
          ReturnType<
            Context.Service.Shape<typeof ReadGitActionReceiptService>['execute']
          >
        >
    >;
  }
>()('@porcelain/server/ReadGitActionReceiptUseCase') {
  static readonly layer = Layer.effect(
    ReadGitActionReceiptUseCase,
    Effect.gen(function* () {
      const checkWorktreeCapability = yield* CheckWorktreeUseCasePort;
      const readGitActionReceiptCapability = yield* ReadGitActionReceiptService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ReadGitActionReceiptUseCase.execute')(function* (
          input: ReadGitActionReceiptParams,
        ): Effect.fn.Return<
          ReadGitActionReceiptResponse,
          | Effect.Error<ReturnType<CheckWorktreeUseCasePort['execute']>>
          | Effect.Error<
              ReturnType<
                Context.Service.Shape<
                  typeof ReadGitActionReceiptService
                >['execute']
              >
            >
        > {
          const worktree = yield* checkWorktreeCapability.execute({
            worktreeId: input.worktreeId,
            requireAvailableProject: false,
          });
          return yield* lanesCapability.run(
            laneKeysCapability.receipts(worktree),
            'read',
            () =>
              readGitActionReceiptCapability.execute({
                worktreeId: worktree.id,
                requestId: input.requestId,
              }),
          );
        }),
      };
    }),
  );
}
