import { type Effect, Context } from 'effect';

export type ReviewActivity =
  | { kind: 'review-ready'; reviewId: string }
  | {
      kind: 'agent-reply';
      reviewId: string | undefined;
      worktreeId: string;
      reply: string;
    };

export interface NotifyReviewActivityUseCasePort {
  execute(activity: ReviewActivity): Effect.Effect<void>;
}

export const NotifyReviewActivityUseCasePort = Context.Service<
  '@porcelain/server/NotifyReviewActivityUseCasePort',
  NotifyReviewActivityUseCasePort
>('@porcelain/server/NotifyReviewActivityUseCasePort');
