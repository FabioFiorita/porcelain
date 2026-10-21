import { Result, Schema } from 'effect';
import { expect, it } from 'vitest';
import { proofDraftSchema } from './review-proof.ts';

it.each(['not a URL', 'ftp://example.com/proof', 'javascript:alert(1)'])(
  'refuses a proof link %s as a schema failure even when collecting every issue',
  (url) => {
    const answer = Schema.decodeUnknownResult(proofDraftSchema, {
      errors: 'all',
    })({ assets: [{ kind: 'link', title: 'Proof', url }] });
    expect(Result.isFailure(answer)).toBe(true);
  },
);
