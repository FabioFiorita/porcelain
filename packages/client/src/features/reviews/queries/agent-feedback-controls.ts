import { Cause } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { reviewCommands } from '../commands/project-reviews.ts';
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
    const commands = reviewCommands(reviewInput);
    const refresh = clientRuntime(input.connection).fn((_input: void) =>
      Atom.refresh(query),
    );
    const state = Atom.make((get) => {
      const result = get(query);
      const record = get(readReview(reviewInput));
      const sending = get(commands.sendAgentFeedback);
      const disconnecting = get(commands.disconnectAgentSession);
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
      const pending = sending.waiting || disconnecting.waiting;
      const settled =
        !result.waiting && AsyncResult.isSuccess(record) && !record.waiting;
      return {
        kind: 'ready' as const,
        ...presentation,
        canSend: presentation.canSend && settled && !pending,
        canDisconnect: presentation.canDisconnect && settled && !pending,
        sending: sending.waiting,
        disconnecting: disconnecting.waiting,
        showActions: result.value.session !== undefined && input.writable,
        deliveryError: result.value.delivery?.error,
        errors: [sending, disconnecting].flatMap((mutation) =>
          AsyncResult.isFailure(mutation)
            ? [reviewErrorMessage(Cause.squash(mutation.cause))]
            : [],
        ),
      };
    });
    return Atom.writable(
      (get) => {
        get(refresh);
        get(commands.sendAgentFeedback);
        get(commands.disconnectAgentSession);
        return get(state);
      },
      (context, action: 'send' | 'disconnect' | 'refresh') => {
        if (action === 'refresh') {
          context.set(refresh, undefined);
          return;
        }
        const view = context.get(state);
        if (view.kind !== 'ready') return;
        if (action === 'send' && view.canSend)
          context.set(commands.sendAgentFeedback, input.reviewRevision);
        if (action === 'disconnect' && view.canDisconnect)
          context.set(commands.disconnectAgentSession, undefined);
      },
    );
  },
);
