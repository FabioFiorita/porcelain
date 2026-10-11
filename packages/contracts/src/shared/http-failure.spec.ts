import { Schema } from 'effect';
import { expect, it } from 'vitest';
import {
  InvalidReviewPointerError,
  ReviewConflictError,
} from '@porcelain/reviews/errors';
import { httpFailure } from './http-failure.ts';

it('encodes a literal wire message and decodes it to the domain error', () => {
  const codec = httpFailure(ReviewConflictError, 'Conflict', {
    message: 'Reload the review',
  });
  const body = {
    statusCode: 409,
    error: 'Conflict',
    message: 'Reload the review',
  };
  expect(Schema.encodeSync(codec)(new ReviewConflictError())).toEqual(body);
  expect(Schema.decodeUnknownSync(codec)(body)).toBeInstanceOf(
    ReviewConflictError,
  );
});

it('preserves an instance message in both directions when the wire cannot reconstruct domain fields', () => {
  const codec = httpFailure(InvalidReviewPointerError, 'BadRequest', {
    message: { fromError: true },
  });
  const failure = new InvalidReviewPointerError({
    layerId: 'layer',
    stepId: 'step',
    path: 'missing.ts',
    startLine: 1,
    endLine: 2,
    reason: 'missing',
  });
  const body = {
    statusCode: 400,
    error: 'Bad Request',
    message:
      'Step `step` in layer `layer` points to `missing.ts:1-2`, which does not exist in this worktree',
  };
  expect(Schema.encodeSync(codec)(failure)).toEqual(body);
  const decoded = Schema.decodeUnknownSync(codec)(body);
  expect(decoded).toBeInstanceOf(Error);
  expect(decoded.name).toBe('InvalidReviewPointerError');
  expect(decoded.message).toBe(body.message);
  expect(Schema.encodeSync(codec)(decoded)).toEqual(body);
});
