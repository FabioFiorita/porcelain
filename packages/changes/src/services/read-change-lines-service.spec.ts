import { describe, expect, it } from 'vitest';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import { ReadChangeLinesService } from './read-change-lines-service.ts';

const text = 'one\ntwo\nthree\nfour\n';
const range = { path: 'a.md', at: 'worktree' as const, text };

describe('ReadChangeLinesService', () => {
  it('answers the lines of the range', () => {
    expect(
      new ReadChangeLinesService({ maxLines: 10 }).execute({
        ...range,
        from: 2,
        to: 3,
      }),
    ).toMatchObject({ from: 2, to: 3, lines: ['two', 'three'] });
  });

  it('answers at most the allowed number of lines', () => {
    expect(
      new ReadChangeLinesService({ maxLines: 2 }).execute({
        ...range,
        from: 1,
        to: 4,
      }).lines,
    ).toEqual(['one', 'two']);
  });

  it('refuses a range that ends before it starts', () => {
    expect(() =>
      new ReadChangeLinesService({ maxLines: 10 }).execute({
        ...range,
        from: 3,
        to: 2,
      }),
    ).toThrow(InvalidLineRangeError);
  });
});
