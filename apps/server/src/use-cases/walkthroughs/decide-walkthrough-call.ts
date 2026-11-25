import type {
  WalkthroughCallNotFoundError,
  WalkthroughTargetNotFoundError,
} from '@porcelain/walkthroughs/errors';
import { Clock, Context, DateTime, Effect, Layer } from 'effect';
import type { DecideWalkthroughCallInput } from '@porcelain/contracts/walkthroughs';
import {
  DecideWalkthroughCallService,
  ListWalkthroughConversationsService,
} from '@porcelain/walkthroughs/services';
import type { WalkthroughConversationsView } from '@porcelain/walkthroughs/models';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class DecideWalkthroughCallUseCase extends Context.Service<
  DecideWalkthroughCallUseCase,
  {
    readonly execute: (
      input: DecideWalkthroughCallInput,
    ) => Effect.Effect<
      WalkthroughConversationsView,
      | WorktreeAccessFailure
      | WalkthroughTargetNotFoundError
      | WalkthroughCallNotFoundError
    >;
  }
>()('@porcelain/server/DecideWalkthroughCallUseCase') {
  static readonly layer = Layer.effect(
    DecideWalkthroughCallUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const decide = yield* DecideWalkthroughCallService;
      const conversations = yield* ListWalkthroughConversationsService;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('DecideWalkthroughCallUseCase.execute')(
          function* (input) {
            const decidedAt = DateTime.formatIso(
              DateTime.makeUnsafe(yield* Clock.currentTimeMillis),
            );
            const view = yield* access.write(input.worktreeId, () =>
              decide
                .execute({
                  worktreeId: input.worktreeId,
                  runId: input.runId,
                  step: input.step,
                  call: input.call,
                  decision: input.decided
                    ? {
                        option: input.option,
                        decidedBy: input.caller,
                        decidedAt,
                      }
                    : undefined,
                })
                .pipe(Effect.andThen(conversations.execute(input))),
            );
            yield* events.worktreeChanged({
              worktreeId: input.worktreeId,
              change: 'walkthrough-conversations',
            });
            return view;
          },
        ),
      };
    }),
  );
}
