import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { InvalidHistoryRequestError } from './errors/invalid-history-request-error.ts';
import { ReadLimitExceededError } from './errors/read-limit-exceeded-error.ts';

const cursorSchema = z.strictObject({
  version: z.literal(1),
  scope: z.string(),
  graph: z.string(),
  offset: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER - 100),
  limit: z.number().int().min(1).max(100),
  snapshot: z.object({
    tipOid: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
    head: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('attached'), ref: z.string() }),
      z.object({ kind: z.literal('detached') }),
    ]),
  }),
});
export type CommitCursor = z.infer<typeof cursorSchema>;

export class CommitCursorCodec {
  private readonly key: Uint8Array;
  constructor(key: Uint8Array) {
    this.key = Uint8Array.from(key);
  }
  encode(value: CommitCursor): string {
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    const cursor = `${payload}.${this.sign(payload).toString('base64url')}`;
    if (cursor.length > 4096) throw new ReadLimitExceededError();
    return cursor;
  }
  decode(cursor: string, scope: string): CommitCursor {
    try {
      if (cursor.length > 4096) throw new Error('Cursor too long');
      const parts = cursor.split('.');
      const [payload, signature] = parts;
      if (parts.length !== 2 || !payload || !signature)
        throw new Error('Invalid cursor');
      const expected = this.sign(payload);
      const actual = Buffer.from(signature, 'base64url');
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        throw new Error('Invalid signature');
      const value = cursorSchema.parse(
        JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
      );
      if (value.scope !== scope) throw new Error('Cursor scope mismatch');
      return value;
    } catch (cause) {
      throw new InvalidHistoryRequestError(cause);
    }
  }
  private sign(payload: string): Buffer {
    return createHmac('sha256', this.key).update(payload).digest();
  }
}
