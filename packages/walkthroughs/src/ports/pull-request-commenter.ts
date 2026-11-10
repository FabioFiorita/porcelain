import { Context, type Effect } from 'effect';
import type { WalkthroughPostFailedError } from '../errors/walkthrough-post-failed-error.ts';
export type PullRequestCommentTarget = {
  readonly owner: string;
  readonly repo: string;
  readonly account: string;
  readonly number: number;
};
export interface PullRequestCommenter {
  readonly comment: (
    input: PullRequestCommentTarget & { readonly body: string },
  ) => Effect.Effect<{ readonly url: string }, WalkthroughPostFailedError>;
}
export const PullRequestCommenter = Context.Service<
  '@porcelain/walkthroughs/PullRequestCommenter',
  PullRequestCommenter
>('@porcelain/walkthroughs/PullRequestCommenter');
