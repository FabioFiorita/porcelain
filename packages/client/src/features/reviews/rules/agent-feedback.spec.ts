import type { ReviewAgentFeedbackResponse } from '@porcelain/contracts/reviews';
import { expect, it } from 'vitest';
import { agentFeedbackPresentation } from './agent-feedback.ts';

const delivery = {
  id: '10000000-0000-4000-8000-000000000001',
  reviewId: '20000000-0000-4000-8000-000000000001',
  reviewRevision: 2,
  commentRevision: 4,
  state: 'delivered' as const,
  attempted: true,
};
const session = { kind: 't3' as const, threadId: 'thread-1' };
function present(
  feedback: ReviewAgentFeedbackResponse,
  reviewRevision = 2,
  writable = true,
) {
  return agentFeedbackPresentation({
    feedback,
    reviewRevision,
    latestRevision: 2,
    writable,
  });
}

it('connects through the agent and never asks the reviewer to enter a session ID', () => {
  expect(present({ currentCommentRevision: 4 })).toMatchObject({
    session: undefined,
    canSend: false,
    reason:
      'Ask the agent to connect this review from its T3 session through MCP.',
  });
  expect(present({ session, currentCommentRevision: 4 })).toMatchObject({
    session: 'T3 · thread-1',
    canSend: true,
  });
});

it('keeps uncertain attempted delivery blocked even after new comments or a new revision', () => {
  const feedback = {
    session,
    currentCommentRevision: 7,
    delivery: { ...delivery, state: 'pending' as const },
  };
  expect(present(feedback)).toMatchObject({
    canSend: false,
    uncertain: true,
    status: 'Delivery outcome unknown',
    reason:
      'The send outcome is unknown. Check the T3 session before sending again. Your comments are saved.',
  });
  expect(
    present({
      ...feedback,
      delivery: { ...feedback.delivery, reviewRevision: 1 },
    }).canSend,
  ).toBe(false);
});

it.each(['delivered', 'acknowledged'] as const)(
  'permits a new saved feedback batch after %s only when its watermark advances',
  (state) => {
    const feedback = {
      session,
      currentCommentRevision: 4,
      delivery: { ...delivery, state },
    };
    expect(present(feedback).canSend).toBe(false);
    expect(present({ ...feedback, currentCommentRevision: 5 }).canSend).toBe(
      true,
    );
  },
);

it('allows an explicit send when the host has not been attempted and retains its error', () => {
  const feedback = {
    session,
    currentCommentRevision: 4,
    delivery: {
      ...delivery,
      state: 'pending' as const,
      attempted: false,
      error: 'T3 is unavailable',
    },
  };
  expect(present(feedback)).toMatchObject({
    canSend: true,
    uncertain: false,
    status: 'Feedback is waiting to be sent.',
  });
});

it('distinguishes host queue delivery from agent receipt and never calls receipt a fix', () => {
  expect(present({ session, currentCommentRevision: 4, delivery }).status).toBe(
    'Delivered to the T3 host queue. The agent has not acknowledged receipt.',
  );
  expect(
    present({
      session,
      currentCommentRevision: 4,
      delivery: { ...delivery, state: 'acknowledged' },
    }).status,
  ).toBe(
    'Acknowledged by the agent. This confirms receipt, not that the feedback is fixed.',
  );
});

it('blocks sending from an older revision and a closed or archived review', () => {
  const feedback = { session, currentCommentRevision: 4 };
  expect(present(feedback, 1).canSend).toBe(false);
  expect(present(feedback, 2, false).canSend).toBe(false);
});

it('keeps a read-only review recipient and delivery visible without either mutation', () => {
  expect(
    present({ session, currentCommentRevision: 4, delivery }, 2, false),
  ).toMatchObject({
    session: 'T3 · thread-1',
    status:
      'Delivered to the T3 host queue. The agent has not acknowledged receipt.',
    canSend: false,
    canDisconnect: false,
  });
  expect(present({ session, currentCommentRevision: 4 }, 1).canDisconnect).toBe(
    false,
  );
  expect(present({ session, currentCommentRevision: 4 }).canDisconnect).toBe(
    true,
  );
});
