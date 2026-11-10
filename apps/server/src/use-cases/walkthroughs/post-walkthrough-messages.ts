import { Context, Effect, Layer } from 'effect';
import {
  ListWalkthroughConversationsService,
  PlanWalkthroughPostService,
  PostWalkthroughMessagesService,
} from '@porcelain/walkthroughs/services';
import type {
  WalkthroughMessageNotFoundError,
  WalkthroughPostFailedError,
} from '@porcelain/walkthroughs/errors';
import type { WalkthroughPostInput } from '@porcelain/contracts/walkthroughs';
import type {
  PostResult,
  PostSelection,
  WalkthroughConversationsView,
} from '@porcelain/walkthroughs/models';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
export class PostWalkthroughMessagesUseCase extends Context.Service<
  PostWalkthroughMessagesUseCase,
  {
    readonly execute: (
      input: WalkthroughPostInput,
    ) => Effect.Effect<
      { outcome: PostResult; view: WalkthroughConversationsView },
      | WorktreeAccessFailure
      | WalkthroughMessageNotFoundError
      | WalkthroughPostFailedError
    >;
  }
>()('@porcelain/server/PostWalkthroughMessagesUseCase') {
  static readonly layer = Layer.effect(
    PostWalkthroughMessagesUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const plans = yield* PlanWalkthroughPostService;
      const post = yield* PostWalkthroughMessagesService;
      const conversations = yield* ListWalkthroughConversationsService;
      const github = yield* ResolveProjectGitHubUseCasePort;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('PostWalkthroughMessagesUseCase.execute')(
          function* (input) {
            const selection: PostSelection =
              input.messageId === undefined
                ? { kind: 'saved' }
                : { kind: 'message', messageId: input.messageId };
            const { plan, projectId, view } = yield* access.read(
              input.worktreeId,
              (worktree) =>
                Effect.gen(function* () {
                  return {
                    plan: yield* plans.execute({ ...input, selection }),
                    projectId: worktree.projectId,
                    view: yield* conversations.execute(input),
                  };
                }),
            );
            if (plan.kind === 'nothing')
              return { outcome: { status: 'nothing' as const }, view };
            if (plan.kind === 'already-posted')
              return {
                outcome: { status: 'posted' as const, url: plan.url },
                view,
              };
            if (plan.pullRequestNumber === undefined)
              return {
                outcome: { status: 'brief' as const, text: plan.text },
                view,
              };
            const resolved = yield* github.execute({ projectId });
            const result = yield* access.write(input.worktreeId, () =>
              Effect.gen(function* () {
                return {
                  outcome: yield* post.execute({
                    worktreeId: input.worktreeId,
                    selection,
                    repository: resolved.repository,
                    account: resolved.selection.choice?.account,
                  }),
                  view: yield* conversations.execute(input),
                };
              }),
            );
            yield* events.worktreeChanged({
              worktreeId: input.worktreeId,
              change: 'walkthrough-conversations',
            });
            return result;
          },
        ),
      };
    }),
  );
}
