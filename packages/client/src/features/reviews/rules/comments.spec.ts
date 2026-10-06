import { describe, expect, it } from 'vitest';
import {
  anchorBase,
  mergeCommentThreads,
  type CommentThread,
  commentBodyValid,
  commentIsStale,
  commentsSeenThrough,
  matchesCommentTarget,
  retainIntent,
} from './comments.ts';

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
  it('waits until every list that holds comments was shown', () => {
    expect(
      commentsSeenThrough(
        { highest: 7, open: 2, resolved: 1 },
        new Set(['open']),
      ),
    ).toBe(null);
  });

  it('marks the latest revision seen once every non-empty list was shown', () => {
    expect(
      commentsSeenThrough(
        { highest: 7, open: 2, resolved: 0 },
        new Set(['open']),
      ),
    ).toBe(7);
  });

  it('marks nothing when there are no comments', () => {
    expect(
      commentsSeenThrough(
        { highest: 0, open: 0, resolved: 0 },
        new Set(['open', 'resolved']),
      ),
    ).toBe(null);
  });
});

describe('commentBodyValid', () => {
  it('accepts written text', () => {
    expect(commentBodyValid('Please rename this')).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(commentBodyValid('')).toBe(false);
  });

  it('rejects a body of only whitespace', () => {
    expect(commentBodyValid(' \n\t ')).toBe(false);
  });

  it('rejects a body holding a NUL character', () => {
    expect(commentBodyValid('before\0after')).toBe(false);
  });

  it('accepts a body at the server limit of 16000 characters', () => {
    expect(commentBodyValid('a'.repeat(16_000))).toBe(true);
  });

  it('rejects a body one character past the server limit', () => {
    expect(commentBodyValid('a'.repeat(16_001))).toBe(false);
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

  it('reveals a comment on the whole branch against its base', () => {
    expect(
      anchorBase({
        kind: 'change',
        comparison: { kind: 'branch', base: 'refs/heads/checkpoint' },
        revision: 'a'.repeat(40),
      }),
    ).toBe('refs/heads/checkpoint');
  });

  it('leaves the base alone for a comment on uncommitted work', () => {
    expect(
      anchorBase({
        kind: 'file',
        filePath: 'notes.md',
        comparison: { kind: 'worktree', scope: 'unstaged' },
      }),
    ).toBeUndefined();
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
