import { Context, Effect, Layer } from 'effect';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { AddWalkthroughMessageRequest } from '@porcelain/contracts/walkthroughs';
import {
  AddWalkthroughMessageService,
  ListWalkthroughConversationsService,
} from '@porcelain/walkthroughs/services';
import type { WalkthroughTargetNotFoundError } from '@porcelain/walkthroughs/errors';
import type { WalkthroughConversationsView } from '@porcelain/walkthroughs/models';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { WalkthroughAnswerQueue } from '../../ports/walkthrough-answer-queue.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
export class AddWalkthroughMessageUseCase extends Context.Service<
  AddWalkthroughMessageUseCase,
  {
    readonly execute: (
      input: WorktreeParams & AddWalkthroughMessageRequest,
    ) => Effect.Effect<
      WalkthroughConversationsView,
      WorktreeAccessFailure | WalkthroughTargetNotFoundError
    >;
  }
>()('@porcelain/server/AddWalkthroughMessageUseCase') {
  static readonly layer = Layer.effect(
    AddWalkthroughMessageUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const add = yield* AddWalkthroughMessageService;
      const conversations = yield* ListWalkthroughConversationsService;
      const answers = yield* WalkthroughAnswerQueue;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('AddWalkthroughMessageUseCase.execute')(
          function* (input) {
            const view = yield* access.write(input.worktreeId, () =>
              add
                .execute(input)
                .pipe(Effect.andThen(conversations.execute(input))),
            );
            yield* answers.execute();
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
