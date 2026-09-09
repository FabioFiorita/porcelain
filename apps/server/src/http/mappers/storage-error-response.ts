import { ArtifactQuotaError } from '../../repositories/errors/artifact-quota-error.ts';
import { FilePreferenceLimitError } from '../../repositories/errors/file-preference-limit-error.ts';
import { ProjectRemovalBlockedError } from '../../repositories/errors/project-removal-blocked-error.ts';
import { ReviewLayerConflictError } from '../../repositories/errors/review-layer-conflict-error.ts';
import { UnknownWorktreeError } from '../../repositories/errors/unknown-worktree-error.ts';
import { ArtifactNotFoundError } from '../../use-cases/errors/artifact-not-found-error.ts';
import { CommentLimitExceededError } from '../../use-cases/errors/comment-limit-exceeded-error.ts';
import { CommentTargetNotFoundError } from '../../use-cases/errors/comment-target-not-found-error.ts';
import { InvalidArtifactError } from '../../use-cases/errors/invalid-artifact-error.ts';
import { InvalidCommentError } from '../../use-cases/errors/invalid-comment-error.ts';
import { InvalidFilePreferenceError } from '../../use-cases/errors/invalid-file-preference-error.ts';
import { ProjectNotFoundError } from '../../use-cases/errors/project-not-found-error.ts';
export function toStorageErrorResponse(error: unknown) {
  if (error instanceof ProjectNotFoundError)
    return {
      statusCode: 404,
      body: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' },
    };
  if (error instanceof ProjectRemovalBlockedError)
    return {
      statusCode: 409,
      body: {
        code: 'PROJECT_REMOVAL_BLOCKED',
        message: 'Project has an active or unresolved Git operation',
      },
    };

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
    error instanceof InvalidCommentError ||
    error instanceof InvalidArtifactError
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
  if (error instanceof ArtifactQuotaError)
    return {
      statusCode: 409,
      body: {
        code: 'ARTIFACT_QUOTA_EXCEEDED',
        message: 'Artifact storage quota exceeded',
      },
    };
  if (error instanceof ArtifactNotFoundError)
    return {
      statusCode: 404,
      body: { code: 'NOT_FOUND', message: 'Artifact not found' },
    };
  return undefined;
}
