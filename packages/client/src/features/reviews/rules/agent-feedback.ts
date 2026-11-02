import type { ReviewAgentFeedbackResponse } from '@porcelain/contracts/reviews';

export function agentFeedbackPresentation({
  feedback,
  reviewRevision,
  latestRevision,
  writable,
}: {
  feedback: ReviewAgentFeedbackResponse;
  reviewRevision: number;
  latestRevision: number | undefined;
  writable: boolean;
}) {
  const delivery = feedback.delivery;
  const uncertain = delivery?.state === 'pending' && delivery.attempted;
  const currentBatch =
    delivery?.reviewRevision === reviewRevision &&
    delivery.commentRevision >= feedback.currentCommentRevision;
  const reason = uncertain
    ? 'The send outcome is unknown. Check the T3 session before sending again. Your comments are saved.'
    : !feedback.session
      ? 'Ask the agent to connect this review from its T3 session through MCP.'
      : !writable || latestRevision !== reviewRevision
        ? 'Open the latest active review to send feedback.'
        : currentBatch && delivery.state !== 'pending'
          ? 'This saved feedback has already been sent. Save new feedback to send another batch.'
          : undefined;
  const status = !delivery
    ? undefined
    : delivery.state === 'acknowledged'
      ? 'Acknowledged by the agent. This confirms receipt, not that the feedback is fixed.'
      : delivery.state === 'delivered'
        ? 'Delivered to the T3 host queue. The agent has not acknowledged receipt.'
        : uncertain
          ? 'Delivery outcome unknown'
          : 'Feedback is waiting to be sent.';
  return {
    session: feedback.session ? `T3 · ${feedback.session.threadId}` : undefined,
    status,
    reason,
    canSend: reason === undefined,
    canDisconnect:
      feedback.session !== undefined &&
      writable &&
      latestRevision === reviewRevision,
    uncertain,
  };
}
