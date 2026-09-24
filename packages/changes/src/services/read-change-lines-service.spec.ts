import { describe, expect, it } from 'vitest';
import { ReadChangeLinesService } from './read-change-lines-service.ts';

const text = 'one\ntwo\nthree\n';
const read = new ReadChangeLinesService({ maxLines: 2 });

describe('ReadChangeLinesService', () => {
  it('answers the requested lines of the text with the side it came from', () => {
    expect(
      read.execute({ text, path: 'a.md', from: 2, to: 3, at: 'worktree' }),
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
      new ReadChangeLinesService({ maxLines: 10 }).execute({
        text,
        path: 'a.md',
        from: 2,
        to: 9,
        at: 'head',
      }),
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
      read.execute({
        text: 'one\ntwo',
        path: 'a.md',
        from: 2,
        to: 2,
        at: 'head',
      }).lines,
    ).toEqual(['two']);
  });

  it('answers an empty range ending just before its start when it begins past the end', () => {
    expect(
      read.execute({ text, path: 'a.md', from: 5, to: 9, at: 'head' }),
    ).toEqual({ at: 'head', path: 'a.md', from: 5, to: 4, lines: [] });
  });

  it('stops at the line limit and reports where it stopped', () => {
    expect(
      read.execute({ text, path: 'a.md', from: 1, to: 3, at: 'head' }),
    ).toEqual({
      at: 'head',
      path: 'a.md',
      from: 1,
      to: 2,
      lines: ['one', 'two'],
    });
  });
});
