import { isRepositoryUnavailable } from '../../git/errors/is-repository-unavailable.ts';
import { ApplicationClosedError } from '../../lifecycle/errors/application-closed-error.ts';
import { ReviewLayerConflictError } from '../../repositories/errors/review-layer-conflict-error.ts';
import { UnknownWorktreeError } from '../../repositories/errors/unknown-worktree-error.ts';
import { UnauthorizedError } from '../errors/unauthorized-error.ts';

export function toErrorResponse(error: unknown) {
  if (error instanceof ReviewLayerConflictError)
    return {
      statusCode: 409,
      body: {
        code: 'REVISION_CONFLICT',
        message: 'Review layers changed; reload before retrying',
      },
    };
  if (error instanceof UnknownWorktreeError)
    return {
      statusCode: 404,
      body: { code: 'UNKNOWN_WORKTREE', message: 'Unknown worktree' },
    };
  if (error instanceof UnauthorizedError) {
    return {
      statusCode: 401,
      body: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    };
  }
  if (
    error instanceof Error &&
    ('validation' in error ||
      ('code' in error &&
        [
          'FST_ERR_CTP_INVALID_JSON_BODY',
          'FST_ERR_CTP_EMPTY_JSON_BODY',
          'FST_ERR_CTP_INVALID_MEDIA_TYPE',
          'FST_ERR_CTP_BODY_TOO_LARGE',
        ].includes(String(error.code))))
  ) {
    return {
      statusCode: 400,
      body: { code: 'INVALID_REQUEST', message: 'Invalid request' },
    };
  }
  if (isRepositoryUnavailable(error)) {
    return {
      statusCode: 422,
      body: {
        code: 'REPOSITORY_UNAVAILABLE',
        message: 'Repository could not be inspected',
      },
    };
  }
  if (
    error instanceof ApplicationClosedError ||
    (error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError'))
  ) {
    return {
      statusCode: 503,
      body: { code: 'SERVICE_UNAVAILABLE', message: 'Operation unavailable' },
    };
  }
  return {
    statusCode: 500,
    body: { code: 'INTERNAL_ERROR', message: 'Operation failed' },
  };
}
