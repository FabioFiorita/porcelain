import { FilePreferenceLimitError } from '../../repositories/errors/file-preference-limit-error.ts';
import { InvalidFilePreferenceError } from '../../use-cases/errors/invalid-file-preference-error.ts';
export function toStorageErrorResponse(error: unknown) {
  if (error instanceof FilePreferenceLimitError)
    return {
      statusCode: 409,
      body: {
        code: 'FILE_PREFERENCE_LIMIT_REACHED',
        message: 'File preference limit reached',
      },
    };
  if (error instanceof InvalidFilePreferenceError)
    return {
      statusCode: 400,
      body: { code: 'INVALID_REQUEST', message: 'Invalid request' },
    };
  return undefined;
}
