import { GitActionRejectedError } from '@porcelain/git/errors/git-action-rejected-error';
import { expect, it } from 'vitest';
import { toGitActionErrorResponse } from './git-action-error-response.ts';

it('explains a refused Git action in its own words, or asks for a fresh look', () => {
  expect(
    toGitActionErrorResponse(
      new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
        detail: 'Git config sets `core.sparseCheckout`.',
      }),
    ),
  ).toEqual({
    statusCode: 409,
    body: {
      code: 'UNSUPPORTED_CONFIGURATION',
      message: 'Git config sets `core.sparseCheckout`.',
    },
  });
  expect(
    toGitActionErrorResponse(new GitActionRejectedError('REQUEST_MISMATCH')),
  ).toEqual({
    statusCode: 409,
    body: {
      code: 'REQUEST_MISMATCH',
      message: 'Git action unavailable; refresh and prepare again',
    },
  });
});
