import { isRepositoryUnavailable } from '../../git/errors/is-repository-unavailable.ts';
import { ApplicationClosedError } from '../../lifecycle/errors/application-closed-error.ts';
import { CommentLimitExceededError } from '../../use-cases/errors/comment-limit-exceeded-error.ts';
import { CommentTargetNotFoundError } from '../../use-cases/errors/comment-target-not-found-error.ts';
import { InvalidCommentError } from '../../use-cases/errors/invalid-comment-error.ts';
import { WorktreeNotFoundError } from '../../use-cases/errors/worktree-not-found-error.ts';
import { UnauthorizedError } from '../errors/unauthorized-error.ts';

export function toErrorResponse(error: unknown) {
  if (error instanceof InvalidCommentError)
    return {
      statusCode: 400,
      body: { code: 'INVALID_REQUEST', message: 'Invalid comment' },
    };
  if (error instanceof CommentLimitExceededError)
    return {
      statusCode: 409,
      body: {
        code: 'COMMENT_LIMIT_EXCEEDED',
        message: 'Comment capacity exceeded',
      },
    };
  if (error instanceof WorktreeNotFoundError)
    return {
      statusCode: 404,
      body: { code: 'WORKTREE_NOT_FOUND', message: 'Worktree not found' },
    };
  if (error instanceof CommentTargetNotFoundError)
    return {
      statusCode: 404,
      body: { code: 'NOT_FOUND', message: 'Comment target not found' },
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
