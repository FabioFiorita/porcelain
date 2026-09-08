import { FilePreferenceLimitError } from '../../repositories/errors/file-preference-limit-error.ts';
import { ReviewLayerConflictError } from '../../repositories/errors/review-layer-conflict-error.ts';
import { UnknownWorktreeError } from '../../repositories/errors/unknown-worktree-error.ts';
import { CommentLimitExceededError } from '../../use-cases/errors/comment-limit-exceeded-error.ts';
import { CommentTargetNotFoundError } from '../../use-cases/errors/comment-target-not-found-error.ts';
import { InvalidCommentError } from '../../use-cases/errors/invalid-comment-error.ts';
import { InvalidFilePreferenceError } from '../../use-cases/errors/invalid-file-preference-error.ts';
export function toStorageErrorResponse(error: unknown) {
  if (error instanceof CommentLimitExceededError)
    return {
      statusCode: 409,
      body: {
        code: 'COMMENT_LIMIT_EXCEEDED',
        message: 'Comment capacity exceeded',
      },
    };
  if (error instanceof CommentTargetNotFoundError)
    return {
      statusCode: 404,
      body: { code: 'NOT_FOUND', message: 'Comment target not found' },
    };
  if (error instanceof FilePreferenceLimitError)
    return {
      statusCode: 409,
      body: {
        code: 'FILE_PREFERENCE_LIMIT_REACHED',
        message: 'File preference limit reached',
      },
    };
  if (
    error instanceof InvalidFilePreferenceError ||
    error instanceof InvalidCommentError
  )
    return {
      statusCode: 400,
      body: { code: 'INVALID_REQUEST', message: 'Invalid request' },
    };
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
      body: { code: 'WORKTREE_NOT_FOUND', message: 'Unknown worktree' },
    };
  return undefined;
}
