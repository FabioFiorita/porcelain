import { describe, expect, it } from 'vitest';
import { changeLines, lineRangeOrdered } from './change-lines.ts';

const text = 'one\ntwo\nthree\n';

describe('changeLines', () => {
  it('answers the requested lines of the text with the side it came from', () => {
    expect(
      changeLines({ text, path: 'a.md', from: 2, to: 3, at: 'worktree' }, 2),
    ).toEqual({
      at: 'worktree',
      path: 'a.md',
      from: 2,
      to: 3,
      lines: ['two', 'three'],
    });
  });

  it('clamps the range to the last line and ignores the final newline', () => {
    expect(
      changeLines(
        {
          text,
          path: 'a.md',
          from: 2,
          to: 9,
          at: 'head',
        },
        10,
      ),
    ).toEqual({
      at: 'head',
      path: 'a.md',
      from: 2,
      to: 3,
      lines: ['two', 'three'],
    });
  });

  it('counts a last line without a newline', () => {
    expect(
      changeLines(
        {
          text: 'one\ntwo',
          path: 'a.md',
          from: 2,
          to: 2,
          at: 'head',
        },
        2,
      ).lines,
    ).toEqual(['two']);
  });

  it('answers an empty range ending just before its start when it begins past the end', () => {
    expect(
      changeLines({ text, path: 'a.md', from: 5, to: 9, at: 'head' }, 2),
    ).toEqual({ at: 'head', path: 'a.md', from: 5, to: 4, lines: [] });
  });

  it('answers the single line of a range that starts and ends on it', () => {
    expect(
      changeLines({ text, path: 'a.md', from: 2, to: 2, at: 'head' }, 2).lines,
    ).toEqual(['two']);
  });

  it('stops at the line limit and reports where it stopped', () => {
    expect(
      changeLines({ text, path: 'a.md', from: 1, to: 3, at: 'head' }, 2),
    ).toEqual({
      at: 'head',
      path: 'a.md',
      from: 1,
      to: 2,
      lines: ['one', 'two'],
    });
  });
});

describe('lineRangeOrdered', () => {
  it('accepts a range that ends on or after its start', () => {
    expect(lineRangeOrdered({ from: 2, to: 2 })).toBe(true);
    expect(lineRangeOrdered({ from: 2, to: 3 })).toBe(true);
  });

  it('refuses a range that ends before it starts', () => {
    expect(lineRangeOrdered({ from: 3, to: 2 })).toBe(false);
  });
});
