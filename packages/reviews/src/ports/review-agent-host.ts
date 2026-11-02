import { Context, type Effect } from 'effect';
import type { ReviewAgentSession } from '../models/agent-feedback.ts';
import type { AgentFeedbackConflictError } from '../errors/agent-feedback-conflict-error.ts';

export type ReviewAgentHostRequest = {
  reviewId: string;
  session: ReviewAgentSession;
  worktreePath: string;
} & ({ kind: 'verify' } | { kind: 'send'; message: string });

export interface ReviewAgentHost {
  readonly execute: (
    input: ReviewAgentHostRequest,
  ) => Effect.Effect<void, AgentFeedbackConflictError>;
}

export const ReviewAgentHost = Context.Service<
  '@porcelain/reviews/ReviewAgentHost',
  ReviewAgentHost
>('@porcelain/reviews/ReviewAgentHost');
