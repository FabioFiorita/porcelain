import { describe, expect, it } from 'vitest';
import type { CommentThread } from '@porcelain/client/reviews/rules';
import { foldThreads, foldedThread, threadSummary } from './thread-folds';

const lines = [
  { id: 'h', text: '@@ -4,3 +4,4 @@' },
  {
    id: 'a',
    text: 'export function submit() {',
    kind: 'context' as const,
    oldLine: 4,
    newLine: 4,
  },
  { id: 'b', text: 'const input = old;', kind: 'removed' as const, oldLine: 5 },
  {
    id: 'c',
    text: 'const input = request();',
    kind: 'added' as const,
    newLine: 5,
  },
  { id: 'd', text: 'return input;', kind: 'added' as const, newLine: 6 },
  { id: 'e', text: '}', kind: 'context' as const, oldLine: 6, newLine: 7 },
];

const thread = (
  id: string,
  anchor: CommentThread['anchor'],
  authors: ('reviewer' | 'agent')[] = ['reviewer', 'agent'],
): CommentThread => ({
  id,
  worktreeId: 'w',
  anchor,
  resolved: false,
  revision: 1,
  messages: authors.map((author, index) => ({
    id: `${id}-${index}`,
    body: 'Body',
    author,
  })),
});

describe('thread folds', () => {
  it('folds each thread under the last line it covers, on its side', () => {
    const added = thread('added', {
      kind: 'codeRange',
      filePath: 'a.ts',
      startLine: 4,
      endLine: 5,
      side: 'additions',
    });
    const removed = thread(
      'removed',
      {
        kind: 'codeRange',
        filePath: 'a.ts',
        startLine: 5,
        endLine: 5,
        side: 'deletions',
      },
      ['reviewer'],
    );
    const folded = foldThreads(lines, [added, removed]);
    expect(folded.lines.map((line) => [line.id, line.kind, line.text])).toEqual(
      [
        ['h', undefined, '@@ -4,3 +4,4 @@'],
        ['a', 'context', 'export function submit() {'],
        ['b', 'removed', 'const input = old;'],
        ['thread:removed', 'gap', '1 comment · Waiting for the agent'],
        ['c', 'added', 'const input = request();'],
        ['thread:added', 'gap', '2 comments · Agent replied'],
        ['d', 'added', 'return input;'],
        ['e', 'context', '}'],
      ],
    );
    expect(folded.unplaced).toEqual([]);
  });

  it('keeps file comments and lines outside the diff apart instead of guessing a line', () => {
    const file = thread('file', { kind: 'file', filePath: 'a.ts' });
    const outside = thread('outside', {
      kind: 'codeRange',
      filePath: 'a.ts',
      startLine: 40,
      endLine: 41,
      side: 'additions',
    });
    const folded = foldThreads(lines, [file, outside]);
    expect(folded.lines).toEqual(lines);
    expect(folded.unplaced.map((entry) => entry.id)).toEqual([
      'file',
      'outside',
    ]);
  });

  it('reads back only the thread rows it folded in', () => {
    expect(foldedThread('thread:3f2a')).toBe('3f2a');
    expect(foldedThread('patch:12')).toBeUndefined();
  });

  it('counts messages and names the thread state', () => {
    expect(
      threadSummary({
        ...thread('t', { kind: 'change' }, ['agent']),
        resolved: true,
      }),
    ).toBe('1 comment · Resolved');
  });
});
