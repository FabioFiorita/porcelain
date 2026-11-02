import { Context, type Effect } from 'effect';
import type { AgentFeedbackConflictError } from '../errors/agent-feedback-conflict-error.ts';
import type {
  ReviewAgentFeedbackState,
  ReviewAgentSession,
} from '../models/agent-feedback.ts';

export interface AgentFeedbackStore {
  read(input: { reviewId: string }): Effect.Effect<ReviewAgentFeedbackState>;
  connect(input: {
    reviewId: string;
    session: ReviewAgentSession;
  }): Effect.Effect<ReviewAgentFeedbackState, AgentFeedbackConflictError>;
  disconnect(input: {
    reviewId: string;
  }): Effect.Effect<ReviewAgentFeedbackState>;
  enqueue(input: {
    reviewId: string;
    reviewRevision: number;
    commentRevision: number;
    deliveryId: string;
  }): Effect.Effect<ReviewAgentFeedbackState, AgentFeedbackConflictError>;
  begin(input: {
    reviewId: string;
    deliveryId: string;
  }): Effect.Effect<boolean, AgentFeedbackConflictError>;
  delivered(input: {
    reviewId: string;
    deliveryId: string;
  }): Effect.Effect<ReviewAgentFeedbackState, AgentFeedbackConflictError>;
  failed(input: {
    reviewId: string;
    deliveryId: string;
    error: string;
  }): Effect.Effect<ReviewAgentFeedbackState, AgentFeedbackConflictError>;
  acknowledge(input: {
    reviewId: string;
    deliveryId: string;
  }): Effect.Effect<
    { feedback: ReviewAgentFeedbackState; accepted: boolean },
    AgentFeedbackConflictError
  >;
}

export const AgentFeedbackStore = Context.Service<
  '@porcelain/reviews/AgentFeedbackStore',
  AgentFeedbackStore
>('@porcelain/reviews/AgentFeedbackStore');
