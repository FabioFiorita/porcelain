import type { WalkthroughTargetNotFoundError } from '@porcelain/walkthroughs/errors';
import { Context, Effect, Layer } from 'effect';
import type {
  SaveWalkthroughMessageRequest,
  WalkthroughMessageParams,
} from '@porcelain/contracts/walkthroughs';
import {
  ListWalkthroughConversationsService,
  SaveWalkthroughMessageService,
} from '@porcelain/walkthroughs/services';
import type { WalkthroughMessageNotFoundError } from '@porcelain/walkthroughs/errors';
import type { WalkthroughConversationsView } from '@porcelain/walkthroughs/models';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
export class SaveWalkthroughMessageUseCase extends Context.Service<
  SaveWalkthroughMessageUseCase,
  {
    readonly execute: (
      input: WalkthroughMessageParams & SaveWalkthroughMessageRequest,
    ) => Effect.Effect<
      WalkthroughConversationsView,
      | WorktreeAccessFailure
      | WalkthroughTargetNotFoundError
      | WalkthroughMessageNotFoundError
    >;
  }
>()('@porcelain/server/SaveWalkthroughMessageUseCase') {
  static readonly layer = Layer.effect(
    SaveWalkthroughMessageUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const save = yield* SaveWalkthroughMessageService;
      const conversations = yield* ListWalkthroughConversationsService;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('SaveWalkthroughMessageUseCase.execute')(
          function* (input) {
            const view = yield* access.write(input.worktreeId, () =>
              save
                .execute(input)
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
