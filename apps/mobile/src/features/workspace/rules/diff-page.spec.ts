import { describe, expect, it } from 'vitest';
import {
  diffBody,
  diffChunk,
  diffCountsLabel,
  diffPageRows,
  fileAtTop,
  headingRow,
  openingFile,
  stuckHeading,
  sourceBody,
} from './diff-page';

const patch = '@@ -1,2 +1,3 @@\n keep\n-old\n+new\n+more\n';

describe('a page of diffs', () => {
  it('draws a text diff inline with its added and removed counts', () => {
    const body = diffBody({ kind: 'text', patch });
    expect(body.kind).toBe('lines');
    expect(diffCountsLabel(body)).toBe('+2 −1');
  });

  it('turns a diff above the inline limit into a compact row that keeps its size', () => {
    expect(diffBody({ kind: 'text', patch }, 3)).toEqual({
      kind: 'large',
      lines: 5,
      added: 2,
      removed: 1,
    });
  });

  it.each([
    [{ kind: 'binary' } as const, 'Binary change'],
    [{ kind: 'omitted', reason: 'size-limit' } as const, 'Too large to show'],
    [
      { kind: 'metadata-only', patch: 'old mode 100644' } as const,
      'Metadata only',
    ],
  ])('shows %o as a compact row titled %s', (content, title) => {
    expect(diffBody(content)).toEqual({ kind: 'notice', title });
  });

  it('reads an untracked file as added lines numbered from one', () => {
    const body = sourceBody('first\r\nsecond\n');
    expect(body).toEqual({
      kind: 'lines',
      added: 2,
      removed: 0,
      lines: [
        { id: '1', text: 'first', newLine: 1, kind: 'added' },
        { id: '2', text: 'second', newLine: 2, kind: 'added' },
      ],
    });
    expect(sourceBody('')).toEqual({ kind: 'notice', title: 'Empty file' });
  });

  it('puts each file heading before its body so headings can stick', () => {
    expect(diffPageRows(2)).toEqual([
      { kind: 'heading', file: 0 },
      { kind: 'body', file: 0 },
      { kind: 'heading', file: 1 },
      { kind: 'body', file: 1 },
    ]);
    expect(headingRow(1)).toBe(2);
  });

  it('names the file whose heading or body is highest on screen', () => {
    expect(fileAtTop([7, 5, 6])).toBe(2);
    expect(fileAtTop([4])).toBe(2);
    expect(fileAtTop([])).toBeUndefined();
  });

  it('pins a file heading only once its own heading has scrolled away', () => {
    expect(stuckHeading([3, 4, 5])).toBe(1);
    expect(stuckHeading([2, 3])).toBeUndefined();
    expect(stuckHeading([])).toBeUndefined();
  });

  it('reads files in fixed groups of twenty so neighbours share one request', () => {
    const files = Array.from({ length: 45 }, (_, index) => index);
    expect(diffChunk(files, 0)).toEqual(files.slice(0, 20));
    expect(diffChunk(files, 19)).toEqual(files.slice(0, 20));
    expect(diffChunk(files, 20)).toEqual(files.slice(20, 40));
    expect(diffChunk(files, 44)).toEqual([40, 41, 42, 43, 44]);
  });

  it('opens at the focused file, else at the file last read, else at the top', () => {
    expect(openingFile(7, 3, 40)).toBe(7);
    expect(openingFile(-1, 3, 40)).toBe(3);
    expect(openingFile(-1, 12, 5)).toBe(0);
  });
});
