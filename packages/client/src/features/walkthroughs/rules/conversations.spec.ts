import type { WalkthroughConversationsResponse } from '@porcelain/contracts/walkthroughs';
import { describe, expect, it } from 'vite-plus/test';
import {
  answerTo,
  canRetryAnswer,
  conversationFailure,
  conversationsAt,
  developerTurns,
  earlierConversations,
  stopConversations,
  isAnswering,
  type WalkthroughAnchor,
} from '@porcelain/client/walkthroughs/rules';

type Conversation = WalkthroughConversationsResponse['conversations'][number];

const developer = (id: string) => ({
  author: 'developer' as const,
  id,
  text: `Question ${id}`,
  createdAt: '2026-11-09T00:00:00.000Z',
});
const agent = (
  id: string,
  state: Extract<
    Conversation['messages'][number],
    { author: 'agent' }
  >['state'],
) => ({
  author: 'agent' as const,
  id: `${id}:answer`,
  replyTo: id,
  createdAt: '2026-11-09T00:00:00.000Z',
  state,
});
const stop = (
  title: string,
  messages: Conversation['messages'],
): Conversation => ({
  runId: 'run',
  anchor: { kind: 'stop', title },
  messages,
});
const wholeAnchor: WalkthroughAnchor = { kind: 'walkthrough' };
const answering = { status: 'answering' as const };
const failed = {
  status: 'failed' as const,
  failure: { kind: 'other' as const, message: 'Stopped' },
};
const view = (
  conversations: Conversation[],
  pullRequestNumber?: number,
): WalkthroughConversationsResponse => ({
  runId: 'run',
  pullRequestNumber,
  conversations,
  decisions: [],
});

describe('walkthrough conversation rules', () => {
  const first = stop('Keep sessions', [developer('a'), agent('a', failed)]);
  const whole: Conversation = {
    runId: 'old',
    anchor: { kind: 'walkthrough' },
    messages: [developer('b'), agent('b', answering)],
  };

  it('returns only the conversations of one stop, or only the whole-walkthrough ones', () => {
    const answer = view([first, whole]);
    expect(
      conversationsAt(answer, { kind: 'stop', title: 'Keep sessions' }),
    ).toEqual([first]);
    expect(conversationsAt(answer, { kind: 'stop', title: 'Other' })).toEqual(
      [],
    );
    expect(conversationsAt(answer, wholeAnchor)).toEqual([whole]);
  });

  it('finds the reply to each message', () => {
    expect(answerTo(first, 'a')?.state).toEqual(failed);
    expect(answerTo(first, 'missing')).toBeUndefined();
  });

  it('allows retry only after a failed answer', () => {
    expect(canRetryAnswer(agent('x', failed))).toBe(true);
    expect(canRetryAnswer(agent('x', answering))).toBe(false);
  });

  it('reports a running answer', () => {
    expect(isAnswering(view([whole]))).toBe(true);
    expect(isAnswering(view([first]))).toBe(false);
  });
});

const question = developer('a');
it('keeps whole-walkthrough and removed-stop threads together near the end', () => {
  const whole = {
    runId: 'old',
    anchor: { kind: 'walkthrough' as const },
    messages: [question],
  };
  const removed = {
    runId: 'old',
    anchor: { kind: 'stop' as const, title: 'Removed stop' },
    messages: [question],
  };
  const current = {
    runId: 'run',
    anchor: { kind: 'stop' as const, title: 'Kept stop' },
    messages: [question],
  };
  expect(
    earlierConversations(
      {
        runId: 'run',
        pullRequestNumber: undefined,
        conversations: [whole, current, removed],
        decisions: [],
      },
      ['Kept stop'],
    ),
  ).toEqual([whole, removed]);
});
it('shows the failure the server gave, or a plain fallback', () => {
  expect(conversationFailure(new Error('Offline'))).toBe('Offline');
  expect(conversationFailure({ status: 500 })).toBe(
    'The request failed. Try again.',
  );
});

describe('turns', () => {
  const answered = {
    status: 'answered' as const,
    text: 'Because.',
    answeredAt: '2026-11-09T00:00:01.000Z',
    durationMs: 1,
    costUsd: undefined,
  };
  const asked = stop('Keep sessions', [
    developer('a'),
    agent('a', answered),
    developer('b'),
  ]);

  it('pairs each developer message with its answer, if any', () => {
    expect(
      developerTurns(asked).map(({ message, reply }) => [
        message.id,
        reply?.state.status,
      ]),
    ).toEqual([
      ['a', 'answered'],
      ['b', undefined],
    ]);
    expect(stopConversations(view([asked]), 'Keep sessions')).toEqual([asked]);
    expect(stopConversations(undefined, 'Keep sessions')).toEqual([]);
  });
});
