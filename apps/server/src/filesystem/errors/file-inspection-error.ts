export type FileErrorCode =
  | 'INVALID_REQUEST'
  | 'WORKTREE_NOT_FOUND'
  | 'REPOSITORY_UNAVAILABLE'
  | 'PATH_NOT_FOUND'
  | 'PATH_NOT_READABLE'
  | 'UNSUPPORTED_PATH'
  | 'UNSUPPORTED_TEXT'
  | 'FILE_TOO_LARGE'
  | 'DIRECTORY_TOO_LARGE'
  | 'CONTENT_CHANGED';
export class FileInspectionError extends Error {
  readonly code: FileErrorCode;
  constructor(code: FileErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = 'FileInspectionError';
    this.code = code;
  }
}
