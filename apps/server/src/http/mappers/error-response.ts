import { isRepositoryUnavailable } from '../../git/errors/is-repository-unavailable.ts';
import { ApplicationClosedError } from '../../lifecycle/errors/application-closed-error.ts';
import { ArtifactQuotaError } from '../../repositories/errors/artifact-quota-error.ts';
import { ArtifactNotFoundError } from '../../use-cases/errors/artifact-not-found-error.ts';
import { InvalidArtifactError } from '../../use-cases/errors/invalid-artifact-error.ts';
import { UnauthorizedError } from '../errors/unauthorized-error.ts';

export function toErrorResponse(error: unknown) {
  if (error instanceof ArtifactNotFoundError)
    return {
      statusCode: 404,
      body: {
        code: 'NOT_FOUND',
        message: 'Artifact or registered worktree not found',
      },
    };
  if (error instanceof ArtifactQuotaError)
    return {
      statusCode: 409,
      body: {
        code: 'ARTIFACT_QUOTA_EXCEEDED',
        message: 'Artifact storage quota exceeded',
      },
    };
  if (error instanceof InvalidArtifactError)
    return {
      statusCode: 400,
      body: { code: 'INVALID_REQUEST', message: 'Invalid request' },
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
