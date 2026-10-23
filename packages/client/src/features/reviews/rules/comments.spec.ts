import { describe, expect, it } from 'vitest';
import {
  anchorBase,
  commentBodyValid,
  questionAnswer,
  commentIsStale,
  commentsSeenThrough,
  matchesCommentTarget,
  mergeCommentThreads,
  retainIntent,
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
