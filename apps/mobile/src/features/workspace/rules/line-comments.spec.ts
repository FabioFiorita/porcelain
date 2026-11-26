import { expect, it } from 'vite-plus/test';
import type { DraftComment } from '@porcelain/client/comments/rules';
import {
  codeLines,
  lineCommentAnchor,
  noteComment,
  selectionLabel,
  withDraftNotes,
} from './line-comments';

const diff = [
  { id: 'h', kind: 'gap' as const, text: '@@ -1,3 +1,3 @@' },
  { id: 'a', kind: 'context' as const, text: 'one', oldLine: 1, newLine: 1 },
  { id: 'b', kind: 'removed' as const, text: 'two', oldLine: 2 },
  { id: 'c', kind: 'added' as const, text: 'TWO', newLine: 2 },
  { id: 'd', kind: 'context' as const, text: 'three', oldLine: 3, newLine: 3 },
];

function draft(id: string, anchor: DraftComment['anchor'], text = 'Why?') {
  return {
    id,
    anchor,
    text,
    headOid: 'h',
    createdAt: '2026-11-25T10:00:00Z',
    updatedAt: '2026-11-25T10:00:00Z',
    publication: { status: 'draft' as const },
    outdated: false,
  };
}

it('snapshots the selected lines from the side they were chosen on', () => {
  expect(
    lineCommentAnchor('src/a.ts', diff, {
      startLine: 2,
      endLine: 3,
      side: 'additions',
    }),
  ).toEqual({
    anchor: {
      kind: 'lines',
      path: 'src/a.ts',
      side: 'additions',
      start: 2,
      end: 3,
      text: 'TWO\nthree',
    },
  });
  expect(
    lineCommentAnchor('src/a.ts', diff, {
      startLine: 2,
      endLine: 2,
      side: 'deletions',
    }),
  ).toMatchObject({ anchor: { side: 'deletions', text: 'two' } });
});

it('treats a plain file selection as new-side lines and orders the range', () => {
  expect(
    lineCommentAnchor('notes.md', codeLines('a\r\nb\nc'), {
      startLine: 3,
      endLine: 2,
    }),
  ).toEqual({
    anchor: {
      kind: 'lines',
      path: 'notes.md',
      side: 'additions',
      start: 2,
      end: 3,
      text: 'b\nc',
    },
  });
});

it('refuses a selection too long to keep as a snapshot', () => {
  const long = codeLines(
    Array.from({ length: 2000 }, () => 'x'.repeat(40)).join('\n'),
  );
  expect(
    lineCommentAnchor('big.ts', long, { startLine: 1, endLine: 2000 }),
  ).toEqual({ refused: 'Select fewer lines to comment on them.' });
});

it('places each draft after its last line, and file drafts first', () => {
  const lines = withDraftNotes(diff, [
    draft('1', {
      kind: 'lines',
      path: 'src/a.ts',
      side: 'additions',
      start: 2,
      end: 2,
      text: 'TWO',
    }),
    draft('2', { kind: 'file', path: 'src/a.ts' }, 'Split\nthis file'),
    draft('3', {
      kind: 'lines',
      path: 'src/a.ts',
      side: 'deletions',
      start: 2,
      end: 2,
      text: 'two',
    }),
  ]);
  expect(lines.map((line) => line.id)).toEqual([
    'comment:2',
    'h',
    'a',
    'b',
    'comment:3',
    'c',
    'comment:1',
    'd',
  ]);
  expect(lines[0]).toEqual({
    id: 'comment:2',
    kind: 'gap',
    text: 'File · Draft: Split this file',
  });
  expect(lines[6]?.text).toBe('Line 2 · Draft: Why?');
  expect(lines[4]?.text).toBe('Removed line 2 · Draft: Why?');
});

it('reads back which draft a note row stands for', () => {
  expect(noteComment('comment:abc')).toBe('abc');
  expect(noteComment('gap-3')).toBeUndefined();
  expect(selectionLabel({ startLine: 4, endLine: 9 })).toBe('Lines 4–9');
});
