import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  listCommitsQuerySchema,
  listFileCommitsQuerySchema,
} from './commit-history.ts';

const first = 'a'.repeat(40);
const second = 'b'.repeat(64);

describe('listCommitsQuerySchema', () => {
  it('reads the after cursor as the object ids it lists, in order', () => {
    expect(
      Schema.decodeUnknownSync(listCommitsQuerySchema)({
        after: `${first},${second}`,
      }),
    ).toEqual({ after: [first, second] });
  });
});

it.each([
  '{',
  JSON.stringify({ offset: 2 }),
  JSON.stringify({ tip: first, offset: -1 }),
  JSON.stringify({ tip: first, offset: 1.5 }),
  JSON.stringify({ tip: 'main', offset: 2 }),
])('refuses an invalid file-history continuation %s', (after) => {
  expect(() =>
    Schema.decodeUnknownSync(listFileCommitsQuerySchema)({
      path: 'notes.md',
      after,
    }),
  ).toThrow();
});
