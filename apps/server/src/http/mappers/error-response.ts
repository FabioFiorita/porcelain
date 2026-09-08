import { GitInspectionTimeoutError } from '../../git/errors/git-inspection-timeout-error.ts';
import { InspectionLimitError } from '../../git/errors/inspection-limit-error.ts';
import { isRepositoryUnavailable } from '../../git/errors/is-repository-unavailable.ts';
import { UnsupportedPathEncodingError } from '../../git/errors/unsupported-path-encoding-error.ts';
import { ApplicationClosedError } from '../../lifecycle/errors/application-closed-error.ts';
import { WorktreeChangedError } from '../../use-cases/errors/worktree-changed-error.ts';
import { WorktreeNotFoundError } from '../../use-cases/errors/worktree-not-found-error.ts';
import { UnauthorizedError } from '../errors/unauthorized-error.ts';

export function toErrorResponse(error: unknown) {
  if (error instanceof WorktreeNotFoundError)
    return {
      statusCode: 404,
      body: { code: 'WORKTREE_NOT_FOUND', message: 'Worktree not found' },
    };
  if (error instanceof WorktreeChangedError)
    return {
      statusCode: 409,
      body: {
        code: 'WORKTREE_CHANGED',
        message: 'Refresh status and retry inspection',
      },
    };
  if (error instanceof InspectionLimitError)
    return {
      statusCode: 413,
      body: {
        code: 'INSPECTION_LIMIT',
        message: 'Git inspection exceeds its limit',
      },
    };
  if (error instanceof UnsupportedPathEncodingError)
    return {
      statusCode: 422,
      body: {
        code: 'UNSUPPORTED_PATH_ENCODING',
        message: 'Git paths require valid UTF-8',
      },
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
    error instanceof GitInspectionTimeoutError ||
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
