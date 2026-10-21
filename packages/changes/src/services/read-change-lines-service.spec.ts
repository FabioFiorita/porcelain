import { ReadChangeLinesOptions } from '@porcelain/changes/ports';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { ReadChangeLinesService } from './read-change-lines-service.ts';

const text = 'one\ntwo\nthree\nfour\n';
const range = { path: 'a.md', at: 'worktree' as const, text };

describe('ReadChangeLinesService', () => {
  it('answers at most the allowed number of lines', () => {
    expect(
      Effect.runSync(
        Effect.runSync(
          ReadChangeLinesService.pipe(
            Effect.provide(ReadChangeLinesService.layer),
            Effect.provideService(ReadChangeLinesOptions, { maxLines: 2 }),
          ),
        ).execute({
          ...range,
          from: 1,
          to: 4,
        }),
      ).lines,
    ).toEqual(['one', 'two']);
  });

  it('refuses a range that ends before it starts', () => {
    expect(() =>
      Effect.runSync(
        Effect.runSync(
          ReadChangeLinesService.pipe(
            Effect.provide(ReadChangeLinesService.layer),
            Effect.provideService(ReadChangeLinesOptions, { maxLines: 10 }),
          ),
        ).execute({
          ...range,
          from: 3,
          to: 2,
        }),
      ),
    ).toThrow(InvalidLineRangeError);
  });
});
