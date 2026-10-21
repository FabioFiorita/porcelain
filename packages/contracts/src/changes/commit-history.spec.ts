import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { listCommitsQuerySchema } from './commit-history.ts';

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
