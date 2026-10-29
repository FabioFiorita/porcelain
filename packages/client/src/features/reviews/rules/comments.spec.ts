import { describe, expect, it } from 'vitest';
import { commentThread as thread } from '../../../../spec/kit/comment-thread.ts';
import {
  anchorBase,
  commentBodyValid,
  questionAnswer,
  commentIsStale,
  commentsSeenThrough,
  decisionMentions,
  messageRevision,
  matchesCommentTarget,
  mergeCommentThreads,
  retainIntent,
  threadCounts,
  threadWriteTarget,
  type CommentThread,
} from './comments.ts';

describe('questionAnswer', () => {
  it.each([
    {
      question: 'Keep both?',
      answer: 'Use one owner.',
      expected: '> Keep both?\n\nUse one owner.',
    },
    {
      question: 'Keep both?\n\nWho owns the transaction?',
      answer: 'The session owner.\nKeep the journal.',
      expected:
        '> Keep both?\n> \n> Who owns the transaction?\n\nThe session owner.\nKeep the journal.',
    },
    {
      question: 'Keep `policy`?',
      answer: '  Keep it.  ',
      expected: '> Keep `policy`?\n\n  Keep it.  ',
    },
    { question: 'Keep both?', answer: '', expected: '> Keep both?\n\n' },
  ])(
    'quotes the complete question and preserves the answer: $question / $answer',
    ({ question, answer, expected }) => {
      expect(questionAnswer(question, answer)).toBe(expected);
    },
  );
});

describe('retainIntent', () => {
  it('reuses the ids of a failed attempt when the same text is sent again', () => {
    const previous = { body: 'Please rename', messageId: 'first' };
    expect(
      retainIntent(previous, 'Please rename', () => ({
        body: 'Please rename',
        messageId: 'second',
      })),
    ).toEqual({ body: 'Please rename', messageId: 'first' });
  });

  it('starts a new comment when the text changed', () => {
    expect(
      retainIntent(
        { body: 'Please', messageId: 'first' },
        'Please rename',
        () => ({
          body: 'Please rename',
          messageId: 'second',
        }),
      ),
    ).toEqual({ body: 'Please rename', messageId: 'second' });
  });
});

describe('commentsSeenThrough', () => {
  it('marks the latest revision seen once every non-empty list was shown', () => {
    expect(
      commentsSeenThrough(
        { highest: 7, open: 2, resolved: 0 },
        new Set(['open']),
      ),
    ).toBe(7);
  });
});

describe('commentBodyValid', () => {
  it('accepts a body at the server limit of 16000 characters', () => {
    expect(commentBodyValid('a'.repeat(16_000))).toBe(true);
  });
});

describe('matchesCommentTarget on the branch review', () => {
  const branchAnchor = {
    kind: 'codeRange' as const,
    filePath: 'notes.md',
    startLine: 2,
    endLine: 2,
    side: 'additions' as const,
    comparison: { kind: 'branch' as const, base: 'refs/heads/main' },
    revision: 'a'.repeat(40),
    contentFingerprint: 'f'.repeat(64),
  };

  it('keeps a branch comment on its file after new commits move the tip', () => {
    expect(
      matchesCommentTarget(branchAnchor, {
        filePath: 'notes.md',
        comparison: { kind: 'branch', base: 'refs/heads/main' },
        revision: 'b'.repeat(40),
        contentFingerprint: 'f'.repeat(64),
      }),
    ).toBe(true);
  });

  it('does not show a branch comment on the uncommitted change of the same file', () => {
    expect(
      matchesCommentTarget(branchAnchor, {
        filePath: 'notes.md',
        comparison: { kind: 'worktree', scope: 'unstaged' },
      }),
    ).toBe(false);
  });

  it('does not show an uncommitted comment on the branch review', () => {
    expect(
      matchesCommentTarget(
        {
          kind: 'file',
          filePath: 'notes.md',
          comparison: { kind: 'worktree', scope: 'unstaged' },
        },
        {
          filePath: 'notes.md',
          comparison: { kind: 'branch', base: 'refs/heads/main' },
          revision: 'a'.repeat(40),
        },
      ),
    ).toBe(false);
  });

  it('marks a branch comment stale once a commit changed the file', () => {
    expect(
      commentIsStale(branchAnchor, {
        filePath: 'notes.md',
        comparison: { kind: 'branch', base: 'refs/heads/main' },
        revision: 'b'.repeat(40),
        contentFingerprint: 'e'.repeat(64),
      }),
    ).toBe(true);
  });
});

describe('anchorBase', () => {
  it('reveals a branch line comment against the base it was written against', () => {
    expect(
      anchorBase({
        kind: 'codeRange',
        filePath: 'notes.md',
        startLine: 1,
        endLine: 1,
        comparison: { kind: 'branch', base: 'refs/remotes/origin/main' },
        revision: 'a'.repeat(40),
      }),
    ).toBe('refs/remotes/origin/main');
  });
});

function discussion(id: string, body: string): CommentThread {
  return {
    id,
    worktreeId: 'worktree',
    anchor: { kind: 'change' },
    resolved: false,
    revision: 1,
    messages: [{ id: 'message', body, author: 'reviewer' }],
  };
}
it('a confirmed edit replaces its discussion and leaves every unrelated discussion intact', () => {
  const original = discussion('edited', 'Before');
  const unrelated = discussion('unrelated', 'Keep this');
  const edited = {
    ...original,
    revision: 2,
    messages: [
      {
        ...original.messages[0],
        id: 'message',
        body: 'After',
        author: 'reviewer' as const,
      },
    ],
  };
  expect(mergeCommentThreads([original, unrelated], [edited])).toEqual([
    edited,
    unrelated,
  ]);
});
it('confirmed deletion removes only the acknowledged discussion and retains skipped discussions', () => {
  const deleted = discussion('deleted', 'Delete this');
  const skipped = discussion('skipped', 'The agent answered');
  expect(mergeCommentThreads([deleted, skipped], [], ['deleted'])).toEqual([
    skipped,
  ]);
});

describe('decisionMentions', () => {
  it.each([
    {
      body: 'Covered in stop 3.',
      expected: [
        { kind: 'text', text: 'Covered in ' },
        { kind: 'decision', text: 'stop 3', decision: 3 },
        { kind: 'text', text: '.' },
      ],
    },
    {
      body: 'Decision 1 and decision 9 both read it',
      expected: [
        { kind: 'decision', text: 'Decision 1', decision: 1 },
        { kind: 'text', text: ' and ' },
        { kind: 'decision', text: 'decision 9', decision: 9 },
        { kind: 'text', text: ' both read it' },
      ],
    },
    {
      body: 'See stop 12, stop 0 and nonstop 3.',
      expected: [{ kind: 'text', text: 'See stop 12, stop 0 and nonstop 3.' }],
    },
    {
      body: 'stop 2',
      expected: [{ kind: 'decision', text: 'stop 2', decision: 2 }],
    },
    { body: '', expected: [] },
  ])('links only decisions the review has: $body', ({ body, expected }) => {
    expect(decisionMentions(body, 9)).toEqual(expected);
  });
});

describe('messageRevision', () => {
  const revisions = [
    { revision: 1, publishedAt: '2026-10-22T10:00:00.000Z' },
    { revision: 3, publishedAt: '2026-10-22T12:00:00.000Z' },
    { revision: 2, publishedAt: '2026-10-22T11:00:00.000Z' },
  ];
  it.each([
    { createdAt: '2026-10-22T11:20:00.000Z', expected: 2 },
    { createdAt: '2026-10-22T12:00:00.000Z', expected: 3 },
    { createdAt: '2026-10-22T13:00:00.000Z', expected: 3 },
    { createdAt: '2026-10-22T09:59:59.000Z', expected: undefined },
    { createdAt: undefined, expected: undefined },
  ])(
    'names the latest revision published by $createdAt',
    ({ createdAt, expected }) => {
      expect(messageRevision(createdAt ? { createdAt } : {}, revisions)).toBe(
        expected,
      );
    },
  );
  it('names no revision for a review without revisions', () => {
    expect(
      messageRevision({ createdAt: '2026-10-22T13:00:00.000Z' }, []),
    ).toBeUndefined();
  });
});

describe('threadWriteTarget', () => {
  const id = 'bb6a4c6a-4898-426c-ac20-bf4f53fc47d7';
  const reviewId = '92825267-1e53-4a39-a954-9c6920e57ffa';
  it.each([
    {
      owner: 'its review',
      thread: { id, review: { reviewId, revision: 2, headOid: 'abc123' } },
      expected: { threadId: id, reviewId },
    },
    {
      owner: 'the worktree',
      thread: { id },
      expected: { threadId: id },
    },
  ])('writes to a thread owned by $owner', ({ thread, expected }) => {
    expect(threadWriteTarget(thread)).toStrictEqual(expected);
  });
});

describe('threadCounts', () => {
  it.each([
    {
      name: 'no threads',
      threads: [],
      expected: { awaitingAgent: 0, awaitingYou: 0, open: 0, resolved: 0 },
    },
    {
      name: 'only resolved threads',
      threads: [
        thread(['reviewer'], true),
        thread(['reviewer', 'agent'], true),
      ],
      expected: { awaitingAgent: 0, awaitingYou: 0, open: 0, resolved: 2 },
    },
    {
      name: 'reviewer comments the agent has not answered',
      threads: [
        thread(['reviewer']),
        thread(['reviewer', 'agent', 'reviewer']),
      ],
      expected: { awaitingAgent: 2, awaitingYou: 0, open: 2, resolved: 0 },
    },
    {
      name: 'a mix of every state',
      threads: [
        thread(['reviewer']),
        thread(['agent']),
        thread(['reviewer', 'agent']),
        thread(['reviewer'], true),
      ],
      expected: { awaitingAgent: 1, awaitingYou: 2, open: 3, resolved: 1 },
    },
  ])('counts $name by who the thread waits on', ({ threads, expected }) => {
    expect(threadCounts(threads)).toStrictEqual(expected);
  });
});
