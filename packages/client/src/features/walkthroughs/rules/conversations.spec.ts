import type { WalkthroughConversationsResponse } from '@porcelain/contracts/walkthroughs';
import { describe, expect, it } from 'vitest';
import {
  answerTo,
  canPostMessage,
  canRetryAnswer,
  conversationFailure,
  conversationsAt,
  developerTurns,
  earlierConversations,
  postLabels,
  postOutcome,
  savedSummary,
  stopConversations,
  postControls,
  postedCommentLabel,
  type DeveloperMessage,
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

const posted: DeveloperMessage = {
  author: 'developer',
  id: 'a',
  text: 'Why?',
  createdAt: '',
  post: { status: 'none' },
};
it('offers posting until saved, Undo while saved, and only the link once posted', () => {
  expect(postControls(posted)).toBe('available');
  expect(postControls({ ...posted, post: { status: 'saved' } })).toBe('saved');
  expect(
    postControls({
      ...posted,
      post: {
        status: 'posted',
        url: 'https://example.com/comment',
        postedAt: '',
      },
    }),
  ).toBe('posted');
});
it('keeps whole-walkthrough and removed-stop threads together near the end', () => {
  const whole = {
    runId: 'old',
    anchor: { kind: 'walkthrough' as const },
    messages: [posted],
  };
  const removed = {
    runId: 'old',
    anchor: { kind: 'stop' as const, title: 'Removed stop' },
    messages: [posted],
  };
  const current = {
    runId: 'run',
    anchor: { kind: 'stop' as const, title: 'Kept stop' },
    messages: [posted],
  };
  expect(
    earlierConversations(
      {
        runId: 'run',
        pullRequestNumber: undefined,
        conversations: [whole, current, removed],
      },
      ['Kept stop'],
    ),
  ).toEqual([whole, removed]);
});
it('explains a refused post and offers the brief without hiding other failures', () => {
  expect(conversationFailure({ status: 409, message: 'Moved' })).toEqual({
    text: 'Nothing was posted. Copy the brief instead.',
    copy: true,
  });
  expect(
    conversationFailure(
      Object.assign(new Error('The repository moved.'), {
        name: 'WalkthroughRepositoryChangedError',
      }),
    ),
  ).toEqual({
    text: 'Nothing was posted. Copy the brief instead.',
    copy: true,
  });
  expect(conversationFailure(new Error('Offline'))).toEqual({
    text: 'Offline',
    copy: false,
  });
});

it.each([
  [
    'https://github.com/example/sample/pull/423#issuecomment-1',
    'Posted on #423',
  ],
  [
    'https://github.example.com/example/sample/issues/17#issuecomment-9',
    'Posted on #17',
  ],
  ['https://example.com/comments/9', 'Posted comment'],
  ['not a URL', 'Posted comment'],
])('labels the stored comment destination %s as %s', (url, label) => {
  expect(postedCommentLabel(url)).toBe(label);
});

describe('posting and saving', () => {
  const answered = {
    status: 'answered' as const,
    text: 'Because.',
    answeredAt: '2026-11-09T00:00:01.000Z',
    durationMs: 1,
    costUsd: undefined,
  };
  const asked = stop('Keep sessions', [
    developer('a', { status: 'saved' }),
    agent('a', answered),
    developer('b', { status: 'saved' }),
  ]);

  it('posts on the pull request when there is one, and copies a prompt otherwise', () => {
    expect(postLabels(423)).toEqual({
      single: 'Post on #423',
      together: 'Post together on #423',
    });
    expect(postLabels(undefined)).toEqual({
      single: 'Copy as prompt',
      together: 'Copy together',
    });
  });

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

  it('counts saved comments for the bar', () => {
    expect(savedSummary(view([asked]))).toBe('2 comments saved');
    expect(
      savedSummary(view([stop('One', [developer('c', { status: 'saved' })])])),
    ).toBe('1 comment saved');
    expect(savedSummary(view([]))).toBeUndefined();
  });

  it('names the comments a partial post left saved, and hands back a brief', () => {
    expect(
      postOutcome({
        outcome: {
          status: 'posted',
          url: 'https://example.com',
          notPosted: ['b'],
        },
        view: view([asked]),
      }),
    ).toEqual({
      kind: 'still-saved',
      messages: [developer('b', { status: 'saved' })],
    });
    expect(
      postOutcome({
        outcome: { status: 'brief', text: 'Do this.' },
        view: view([]),
      }),
    ).toEqual({ kind: 'brief', text: 'Do this.' });
    expect(
      postOutcome({
        outcome: {
          status: 'posted',
          url: 'https://example.com',
          notPosted: [],
        },
        view: view([]),
      }),
    ).toEqual({ kind: 'done' });
  });
});
