import { GitActionRejectedError } from '../../git/errors/git-action-rejected-error.ts';
import { GitActionNotFoundError } from '../../use-cases/errors/git-action-not-found-error.ts';

export function toGitActionErrorResponse(error: unknown) {
  if (error instanceof GitActionRejectedError)
    return {
      statusCode: 409,
      body: {
        code: error.reason,
        message: 'Git action unavailable; refresh and prepare again',
      },
    };
  if (error instanceof GitActionNotFoundError)
    return {
      statusCode: 404,
      body: { code: 'NOT_FOUND', message: 'Git action receipt not found' },
    };

  return undefined;
}
