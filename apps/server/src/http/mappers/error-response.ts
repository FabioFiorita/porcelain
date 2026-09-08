import { isRepositoryUnavailable } from '../../git/errors/is-repository-unavailable.ts';
import { ApplicationClosedError } from '../../lifecycle/errors/application-closed-error.ts';

export function toErrorResponse(error: unknown) {
  if (
    error instanceof Error &&
    ('validation' in error ||
      ('statusCode' in error &&
        typeof error.statusCode === 'number' &&
        error.statusCode >= 400 &&
        error.statusCode < 500))
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
