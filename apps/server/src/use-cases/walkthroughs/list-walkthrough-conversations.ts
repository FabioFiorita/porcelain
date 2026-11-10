import type { WalkthroughTargetNotFoundError } from '@porcelain/walkthroughs/errors';
import { Context, Effect, Layer } from 'effect';
import type { WalkthroughConversationParams } from '@porcelain/contracts/walkthroughs';
import { ListWalkthroughConversationsService } from '@porcelain/walkthroughs/services';
import type { WalkthroughConversationsView } from '@porcelain/walkthroughs/models';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
export class ListWalkthroughConversationsUseCase extends Context.Service<
  ListWalkthroughConversationsUseCase,
  {
    readonly execute: (
      input: WalkthroughConversationParams,
    ) => Effect.Effect<
      WalkthroughConversationsView,
      WorktreeAccessFailure | WalkthroughTargetNotFoundError
    >;
  }
>()('@porcelain/server/ListWalkthroughConversationsUseCase') {
  static readonly layer = Layer.effect(
    ListWalkthroughConversationsUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const conversations = yield* ListWalkthroughConversationsService;
      return {
        execute: Effect.fn('ListWalkthroughConversationsUseCase.execute')(
          (input) =>
            access.read(input.worktreeId, () => conversations.execute(input)),
        ),
      };
    }),
  );
}
