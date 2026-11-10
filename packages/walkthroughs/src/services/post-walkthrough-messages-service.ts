import { Context, DateTime, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import {
  PullRequestCommenter,
  type PullRequestCommentTarget,
} from '../ports/pull-request-commenter.ts';
import type { PostResult, PostSelection } from '../models/conversation.ts';
import type { WalkthroughMessageNotFoundError } from '../errors/walkthrough-message-not-found-error.ts';
import { WalkthroughPostFailedError } from '../errors/walkthrough-post-failed-error.ts';
import { WalkthroughRepositoryChangedError } from '../errors/walkthrough-repository-changed-error.ts';
import { PlanWalkthroughPostService } from './plan-walkthrough-post-service.ts';

const MAX_COMMENT_LENGTH = 60000;
const sameRepository = (
  left: { owner: string; repo: string },
  right: { owner: string; repo: string },
) =>
  left.owner.toLowerCase() === right.owner.toLowerCase() &&
  left.repo.toLowerCase() === right.repo.toLowerCase();

export class PostWalkthroughMessagesService extends Context.Service<
  PostWalkthroughMessagesService,
  {
    readonly execute: (input: {
      worktreeId: string;
      selection: PostSelection;
      repository: Pick<PullRequestCommentTarget, 'owner' | 'repo'> | undefined;
      account: string | undefined;
    }) => Effect.Effect<
      PostResult,
      | WalkthroughMessageNotFoundError
      | WalkthroughPostFailedError
      | WalkthroughRepositoryChangedError
    >;
  }
>()('@porcelain/walkthroughs/PostWalkthroughMessagesService') {
  static readonly layer = Layer.effect(
    PostWalkthroughMessagesService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const commenter = yield* PullRequestCommenter;
      const plans = yield* PlanWalkthroughPostService;
      return {
        execute: Effect.fn('PostWalkthroughMessagesService.execute')(
          function* (input) {
            const plan = yield* plans.execute(input);
            if (plan.kind === 'nothing') return { status: 'nothing' };
            if (plan.kind === 'already-posted')
              return { status: 'posted', url: plan.url };
            if (plan.pullRequestNumber === undefined)
              return { status: 'brief', text: plan.text };
            if (plan.repository === undefined)
              return yield* new WalkthroughRepositoryChangedError({
                message:
                  "This walkthrough did not record its pull request's repository. Nothing was posted. Copy the brief instead.",
              });
            if (
              input.repository === undefined ||
              !sameRepository(plan.repository, input.repository)
            )
              return yield* new WalkthroughRepositoryChangedError({
                message: `This walkthrough's pull request is on ${plan.repository.owner}/${plan.repository.repo}, but this project's origin no longer points there. Nothing was posted. Copy the brief instead.`,
              });
            if (plan.text.length > MAX_COMMENT_LENGTH)
              return yield* new WalkthroughPostFailedError({
                message:
                  'These messages are too long for one pull request comment. Post fewer together.',
              });
            if (input.account === undefined)
              return yield* new WalkthroughPostFailedError({
                message:
                  'Choose a GitHub account that can read this repository.',
              });
            const { url } = yield* commenter.comment({
              ...plan.repository,
              account: input.account,
              number: plan.pullRequestNumber,
              body: plan.text,
            });
            yield* store.markPosted(
              input.worktreeId,
              plan.messageIds,
              url,
              yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
            );
            return { status: 'posted', url };
          },
        ),
      };
    }),
  );
}
