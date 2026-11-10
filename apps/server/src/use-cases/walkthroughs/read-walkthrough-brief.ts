import type { GitIoFailure } from '@porcelain/git/errors';
import { Context, Effect, Layer } from 'effect';
import type { WalkthroughPostInput } from '@porcelain/contracts/walkthroughs';
import { PlanWalkthroughPostService } from '@porcelain/walkthroughs/services';
import type { WalkthroughMessageNotFoundError } from '@porcelain/walkthroughs/errors';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
export class ReadWalkthroughBriefUseCase extends Context.Service<
  ReadWalkthroughBriefUseCase,
  {
    readonly execute: (
      input: WalkthroughPostInput,
    ) => Effect.Effect<
      string | undefined,
      WorktreeAccessFailure | GitIoFailure | WalkthroughMessageNotFoundError
    >;
  }
>()('@porcelain/server/ReadWalkthroughBriefUseCase') {
  static readonly layer = Layer.effect(
    ReadWalkthroughBriefUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const plans = yield* PlanWalkthroughPostService;
      return {
        execute: Effect.fn('ReadWalkthroughBriefUseCase.execute')((input) =>
          access.read(input.worktreeId, () =>
            plans
              .execute({
                worktreeId: input.worktreeId,
                selection:
                  input.messageId === undefined
                    ? { kind: 'saved' }
                    : { kind: 'message', messageId: input.messageId },
              })
              .pipe(
                Effect.map((plan) =>
                  plan.kind === 'write' ? plan.text : undefined,
                ),
              ),
          ),
        ),
      };
    }),
  );
}
