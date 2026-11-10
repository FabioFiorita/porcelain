import { Schema } from 'effect';
import { expect, it } from 'vitest';
import { ReviewedMarkConflictError } from '@porcelain/reviews/errors';
import { BranchArchiveRefusedError } from '@porcelain/projects/errors';
import { httpFailure } from './http-failure.ts';

it('encodes a literal wire message and decodes it to the domain error', () => {
  const codec = httpFailure(ReviewedMarkConflictError, 'Conflict', {
    message: 'Reload the review',
  });
  const body = {
    statusCode: 409,
    error: 'Conflict',
    message: 'Reload the review',
  };
  expect(Schema.encodeSync(codec)(new ReviewedMarkConflictError())).toEqual(
    body,
  );
  expect(Schema.decodeUnknownSync(codec)(body)).toBeInstanceOf(
    ReviewedMarkConflictError,
  );
});

it('preserves an instance message in both directions when the wire cannot reconstruct domain fields', () => {
  const codec = httpFailure(BranchArchiveRefusedError, 'BadRequest', {
    message: { fromError: true },
  });
  const failure = new BranchArchiveRefusedError({
    message: 'The worktree branch changed. Nothing was deleted.',
  });
  const body = {
    statusCode: 400,
    error: 'Bad Request',
    message: 'The worktree branch changed. Nothing was deleted.',
  };
  expect(Schema.encodeSync(codec)(failure)).toEqual(body);
  const decoded = Schema.decodeUnknownSync(codec)(body);
  expect(decoded).toBeInstanceOf(Error);
  expect(decoded.name).toBe('BranchArchiveRefusedError');
  expect(decoded.message).toBe(body.message);
  expect(Schema.encodeSync(codec)(decoded)).toEqual(body);
});
