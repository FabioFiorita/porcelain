import type { WalkthroughConversationsResponse } from '@porcelain/contracts/walkthroughs';
import { describe, expect, it } from 'vitest';
import {
  answerTo,
  canPostMessage,
  canRetryAnswer,
  conversationsAt,
  isAnswering,
  postDestination,
  savedMessageCount,
  type WalkthroughAnchor,
} from '@porcelain/client/walkthroughs/rules';

type Conversation = WalkthroughConversationsResponse['conversations'][number];

const developer = (
  id: string,
  post:
    | { status: 'none' }
    | { status: 'saved' }
    | { status: 'posted'; url: string; postedAt: string },
) => ({
  author: 'developer' as const,
  id,
  text: `Question ${id}`,
  createdAt: '2026-11-09T00:00:00.000Z',
  post,
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
});

describe('walkthrough conversation rules', () => {
  const first = stop('Keep sessions', [
    developer('a', { status: 'saved' }),
    agent('a', failed),
  ]);
  const whole: Conversation = {
    runId: 'old',
    anchor: { kind: 'walkthrough' },
    messages: [developer('b', { status: 'none' }), agent('b', answering)],
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

  it('counts only messages saved for later and finds the reply to each message', () => {
    const answer = view([first, whole]);
    expect(savedMessageCount(answer)).toBe(1);
    expect(answerTo(first, 'a')?.state).toEqual(failed);
    expect(answerTo(first, 'missing')).toBeUndefined();
  });

  it('allows retry only after a failed answer and posting only until posted', () => {
    expect(canRetryAnswer(agent('x', failed))).toBe(true);
    expect(canRetryAnswer(agent('x', answering))).toBe(false);
    expect(canPostMessage(developer('x', { status: 'saved' }))).toBe(true);
    expect(
      canPostMessage(
        developer('x', {
          status: 'posted',
          url: 'https://github.com/o/r/pull/1#issuecomment-1',
          postedAt: '2026-11-09T00:00:00.000Z',
        }),
      ),
    ).toBe(false);
  });

  it('reports a running answer and where posting goes', () => {
    expect(isAnswering(view([whole]))).toBe(true);
    expect(isAnswering(view([first]))).toBe(false);
    expect(postDestination(view([], 41))).toBe('pull-request');
    expect(postDestination(view([]))).toBe('copy');
  });
});
