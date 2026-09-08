import { randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { type CommitCursor, CommitCursorCodec } from './commit-cursor.ts';
import { ReadLimitExceededError } from './errors/read-limit-exceeded-error.ts';

it('never emits an unusable continuation for a long ref', () => {
  const codec = new CommitCursorCodec(randomBytes(32));
  const value: CommitCursor = {
    version: 1,
    scope: 'environment:project:worktree',
    graph: 'a'.repeat(64),
    offset: 50,
    limit: 50,
    snapshot: {
      tipOid: 'b'.repeat(40),
      head: { kind: 'attached', ref: 'refs/heads/main' },
    },
  };
  expect(codec.decode(codec.encode(value), value.scope)).toEqual(value);
  const longRef = `refs/heads/${'segment/'.repeat(360)}branch`;
  expect(() =>
    codec.encode({
      ...value,
      snapshot: { ...value.snapshot, head: { kind: 'attached', ref: longRef } },
    }),
  ).toThrow(ReadLimitExceededError);
});
