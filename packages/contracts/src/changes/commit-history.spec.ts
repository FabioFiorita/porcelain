import { describe, expect, it } from 'vitest';
import { listCommitsQuerySchema } from './commit-history.ts';

const first = 'a'.repeat(40);
const second = 'b'.repeat(64);

describe('listCommitsQuerySchema', () => {
  it('reads the after cursor as the object ids it lists, in order', () => {
    expect(
      listCommitsQuerySchema.decode({ after: `${first},${second}` }),
    ).toEqual({ after: [first, second] });
  });

  it('writes a cursor back as the object ids joined by commas', () => {
    expect(listCommitsQuerySchema.encode({ after: [second, first] })).toEqual({
      after: `${second},${first}`,
    });
  });

  it('refuses a cursor with an empty or malformed entry', () => {
    expect(() =>
      listCommitsQuerySchema.decode({ after: `${first},` }),
    ).toThrow();
    expect(() =>
      listCommitsQuerySchema.decode({ after: `${first},not-an-oid` }),
    ).toThrow();
  });
});
