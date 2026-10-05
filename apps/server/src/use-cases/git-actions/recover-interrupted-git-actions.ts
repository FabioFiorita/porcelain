import { Effect, Context, Layer } from 'effect';
import {
  ExpireGitActionReceiptsService,
  RecoverInterruptedGitActionsService,
} from '@porcelain/git-actions/services';
import { ListRecordedWorktreesService } from '@porcelain/projects/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RecoverInterruptedGitActionsUseCase extends Context.Service<
  RecoverInterruptedGitActionsUseCase,
  { readonly execute: () => Effect.Effect<void> }
>()('@porcelain/server/RecoverInterruptedGitActionsUseCase') {
  static readonly layer = Layer.effect(
    RecoverInterruptedGitActionsUseCase,
    Effect.gen(function* () {
      const listRecordedWorktreesCapability =
        yield* ListRecordedWorktreesService;
      const recoverInterruptedGitActionsCapability =
        yield* RecoverInterruptedGitActionsService;
      const expireGitActionReceiptsCapability =
        yield* ExpireGitActionReceiptsService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('RecoverInterruptedGitActionsUseCase.execute')(
          function* (): Effect.fn.Return<void> {
            const { worktrees } = yield* lanesCapability.run(
              laneKeysCapability.inventory(),
              'read',
              () => listRecordedWorktreesCapability.execute(),
            );
            for (const worktree of worktrees)
              yield* lanesCapability.run(
                laneKeysCapability.receipts(worktree),
                'write',
                () =>
                  Effect.gen(function* () {
                    yield* recoverInterruptedGitActionsCapability.execute({
                      worktreeId: worktree.id,
                    });
                    yield* expireGitActionReceiptsCapability.execute({
                      worktreeId: worktree.id,
                    });
                  }),
              );
          },
        ),
      };
    }),
  );
}
