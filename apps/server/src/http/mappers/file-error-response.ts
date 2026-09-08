import type { FileErrorCode } from '../../filesystem/errors/file-inspection-error.ts';

const failures: Record<FileErrorCode, { statusCode: number; message: string }> =
  {
    INVALID_REQUEST: { statusCode: 400, message: 'Invalid request' },
    WORKTREE_NOT_FOUND: { statusCode: 404, message: 'Worktree not found' },
    REPOSITORY_UNAVAILABLE: {
      statusCode: 422,
      message: 'Repository could not be inspected',
    },
    PATH_NOT_FOUND: { statusCode: 404, message: 'Path not found' },
    PATH_NOT_READABLE: { statusCode: 422, message: 'Path could not be read' },
    UNSUPPORTED_PATH: {
      statusCode: 422,
      message: 'Directory contains a name that is not supported UTF-8',
    },
    UNSUPPORTED_TEXT: {
      statusCode: 422,
      message: 'File is not supported UTF-8 text',
    },
    FILE_TOO_LARGE: { statusCode: 422, message: 'File exceeds the read limit' },
    DIRECTORY_TOO_LARGE: {
      statusCode: 422,
      message: 'Directory exceeds the listing limit',
    },
    CONTENT_CHANGED: {
      statusCode: 409,
      message: 'Content changed; retry the operation',
    },
  };
export function toFileErrorResponse(code: FileErrorCode) {
  const { statusCode, message } = failures[code];
  return { statusCode, body: { code, message } };
}
