import { Context, DateTime, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import {
  PullRequestCommenter,
  type PullRequestCommentTarget,
} from '../ports/pull-request-commenter.ts';
import type { PostResult, PostPlan } from '../models/conversation.ts';
import type { WalkthroughTargetNotFoundError } from '../errors/walkthrough-target-not-found-error.ts';
import { WalkthroughPostFailedError } from '../errors/walkthrough-post-failed-error.ts';
import { WalkthroughRepositoryChangedError } from '../errors/walkthrough-repository-changed-error.ts';
import { ReadWalkthroughTargetService } from './read-walkthrough-target-service.ts';
import { messagePostSnapshot, sameRepository } from '../rules/conversations.ts';

const MAX_COMMENT_LENGTH = 60000;

export class PostWalkthroughMessagesService extends Context.Service<
  PostWalkthroughMessagesService,
  {
    readonly execute: (input: {
      worktreeId: string;
      plan: Extract<PostPlan, { kind: 'write' }>;
      repository: Pick<PullRequestCommentTarget, 'owner' | 'repo'> | undefined;
      account: string | undefined;
    }) => Effect.Effect<
      PostResult,
      | WalkthroughTargetNotFoundError
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
      const plans = yield* ReadWalkthroughTargetService;
      return {
        execute: Effect.fn('PostWalkthroughMessagesService.execute')(
          function* (input) {
            const { plan } = input;
            const observed = yield* plans.execute({
              worktreeId: input.worktreeId,
              runId: plan.target.id,
            });
            const changed = () =>
              new WalkthroughRepositoryChangedError({
                message:
                  'The walkthrough or selected messages changed before posting. Nothing was posted. Try again.',
              });
            if (JSON.stringify(observed.target) !== JSON.stringify(plan.target))
              return yield* changed();
            const actual = plan.messageIds.map((id) =>
              observed.messages.find((message) => message.id === id),
            );
            const posted = actual.filter(
              (message) => message?.post.status === 'posted',
            );
            const first = posted[0];
            const postedUrl =
              first?.post.status === 'posted' ? first.post.url : undefined;
            if (
              actual.length > 0 &&
              posted.length === actual.length &&
              postedUrl !== undefined &&
              posted.every(
                (message) =>
                  message?.post.status === 'posted' &&
                  message.post.url === postedUrl,
              )
            )
              return {
                status: 'posted',
                url: postedUrl,
                notPosted: plan.notPosted,
              };
            const selected =
              plan.selection.kind === 'saved'
                ? observed.messages.filter(
                    (message) => message.post.status === 'saved',
                  )
                : observed.messages.filter(
                    (message) =>
                      plan.selection.kind === 'message' &&
                      message.id === plan.selection.messageId,
                  );
            if (
              JSON.stringify(selected.map(messagePostSnapshot)) !==
              JSON.stringify(plan.snapshots)
            )
              return yield* changed();
            if (
              plan.messageIds.some((id) => {
                const message = observed.messages.find(
                  (item) => item.id === id,
                );
                const run = observed.readyRuns.find(
                  (item) => item.id === message?.runId,
                );
                return !sameRepository(
                  run?.pullRequestRepository,
                  plan.repository,
                );
              })
            )
              return yield* changed();
            if (plan.pullRequestNumber === undefined)
              return { status: 'brief', text: plan.text };
            if (plan.repository === undefined)
              return yield* new WalkthroughRepositoryChangedError({
                message:
                  "This walkthrough did not record its pull request's repository. Nothing was posted. Copy the brief instead.",
              });
            if (!sameRepository(plan.repository, input.repository))
              return yield* new WalkthroughRepositoryChangedError({
                message: `This walkthrough's pull request is on ${plan.repository.owner}/${plan.repository.repo}, but this project's origin no longer points there. Nothing was posted. Copy the brief instead.`,
              });
            if (plan.messageIds.length === 0)
              return yield* new WalkthroughRepositoryChangedError({
                message: `These messages were made on a walkthrough of another repository than ${plan.repository.owner}/${plan.repository.repo}. Nothing was posted. Copy the brief instead.`,
              });
            if (plan.comment.length > MAX_COMMENT_LENGTH)
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
              body: plan.comment,
            });
            yield* store.markPosted(
              input.worktreeId,
              plan.messageIds,
              url,
              yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
            );
            return { status: 'posted', url, notPosted: plan.notPosted };
          },
        ),
      };
    }),
  );
}
