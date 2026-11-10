import type { GitIoFailure } from '@porcelain/git/errors';
import { Context, Effect, Layer } from 'effect';
import type { WalkthroughMessageParams } from '@porcelain/contracts/walkthroughs';
import {
  ListWalkthroughConversationsService,
  RetryWalkthroughAnswerService,
} from '@porcelain/walkthroughs/services';
import type { WalkthroughMessageNotFoundError } from '@porcelain/walkthroughs/errors';
import type { WalkthroughConversationsView } from '@porcelain/walkthroughs/models';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { WalkthroughAnswerQueue } from '../../ports/walkthrough-answer-queue.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
export class RetryWalkthroughAnswerUseCase extends Context.Service<
  RetryWalkthroughAnswerUseCase,
  {
    readonly execute: (
      input: WalkthroughMessageParams,
    ) => Effect.Effect<
      WalkthroughConversationsView,
      WorktreeAccessFailure | GitIoFailure | WalkthroughMessageNotFoundError
    >;
  }
>()('@porcelain/server/RetryWalkthroughAnswerUseCase') {
  static readonly layer = Layer.effect(
    RetryWalkthroughAnswerUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const retry = yield* RetryWalkthroughAnswerService;
      const conversations = yield* ListWalkthroughConversationsService;
      const answers = yield* WalkthroughAnswerQueue;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('RetryWalkthroughAnswerUseCase.execute')(
          function* (input) {
            const { view, requeued } = yield* access.write(
              input.worktreeId,
              () =>
                Effect.gen(function* () {
                  const requeued = yield* retry.execute(input);
                  return {
                    requeued,
                    view: yield* conversations.execute(input),
                  };
                }),
            );
            if (requeued) {
              yield* answers.execute();
              yield* events.worktreeChanged({
                worktreeId: input.worktreeId,
                change: 'walkthrough-conversations',
              });
            }
            return view;
          },
        ),
      };
    }),
  );
}
