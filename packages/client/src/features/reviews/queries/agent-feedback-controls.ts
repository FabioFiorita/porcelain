import { Cause } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

import { agentFeedbackPresentation } from '../rules/agent-feedback.ts';
import { reviewErrorMessage } from '../../reviews/rules/review.ts';
import { readReview, readReviewAgentFeedback } from './project-reviews.ts';

export type AgentFeedbackInput = {
  connection: RuntimeConnection;
  reviewId: string;
  reviewRevision: number;
  writable: boolean;
};

export const agentFeedbackControls = Atom.family(
  (input: AgentFeedbackInput) => {
    const reviewInput = {
      connection: input.connection,
      reviewId: input.reviewId,
    };
    const query = readReviewAgentFeedback(reviewInput);
    const refresh = clientRuntime(input.connection).fn((_input: void) =>
      Atom.refresh(query),
    );
    const state = Atom.make((get) => {
      const result = get(query);
      const record = get(readReview(reviewInput));
      if (!AsyncResult.isSuccess(result))
        return AsyncResult.isFailure(result)
          ? {
              kind: 'failure' as const,
              error: reviewErrorMessage(Cause.squash(result.cause)),
            }
          : { kind: 'loading' as const };
      const current = AsyncResult.isSuccess(record)
        ? record.value.review
        : undefined;
      const presentation = agentFeedbackPresentation({
        feedback: result.value,
        reviewRevision: input.reviewRevision,
        latestRevision: current?.latestRevision,
        writable:
          input.writable && current?.state === 'open' && !current.archived,
      });
      return {
        kind: 'ready' as const,
        ...presentation,
        canSend: false,
        canDisconnect: false,
        sending: false,
        disconnecting: false,
        showActions: false,
        deliveryError: result.value.delivery?.error,
        errors: [],
      };
    });
    return Atom.writable(
      (get) => {
        get(refresh);
        return get(state);
      },
      (context, action: 'send' | 'disconnect' | 'refresh') => {
        if (action === 'refresh') {
          context.set(refresh, undefined);
          return;
        }
        const view = context.get(state);
        if (view.kind !== 'ready') return;
      },
    );
  },
);
