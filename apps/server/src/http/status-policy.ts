import { STATUS_CODES } from 'node:http';
import {
  InvalidDeviceDetailsError,
  InvalidPairingAddressError,
  InvalidPairingError,
} from '@porcelain/access/errors';
import { GitActionRejectedError } from '@porcelain/git/actions';
import { isRepositoryUnavailable } from '@porcelain/git/discovery';
import {
  HistorySnapshotUnavailableError,
  HistoryWorktreeUnavailableError,
  InvalidHistoryRequestError,
  ReadLimitExceededError,
  UnsupportedHistoryDataError,
} from '@porcelain/git/history';
import {
  GitInspectionTimeoutError,
  InspectionLimitError,
  UnsupportedGitFiltersError,
  UnsupportedPathEncodingError,
} from '@porcelain/git/inspection';
import {
  FilePreferenceLimitError,
  InvalidFilePreferenceError,
  ProjectNotFoundError,
} from '@porcelain/projects/errors';
import {
  FileInspectionError,
  type FileErrorCode,
} from '@porcelain/files/errors';
import { ApplicationClosedError } from '../runtime/errors/application-closed-error.ts';
import {
  CommentIdentityConflictError,
  CommentLimitExceededError,
  CommentTargetNotFoundError,
  InvalidCommentError,
  ReviewConflictError,
} from '@porcelain/reviews/errors';
import {
  CommitDraftError,
  GitActionNotFoundError,
  GitActionReceiptMismatchError,
  WorktreeChangedError as GitActionWorktreeChangedError,
} from '@porcelain/git-actions/errors';
import { WorktreeChangedError as ChangesWorktreeChangedError } from '@porcelain/changes/errors';
import { ReviewedMarkConflictError } from '@porcelain/reviews/errors';
import { WorktreeNotFoundError } from '@porcelain/projects/errors';

const fileFailures: Record<
  FileErrorCode,
  { statusCode: number; message: string }
> = {
  ENTRY_EXISTS: {
    statusCode: 409,
    message: 'An entry already exists at that path',
  },
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
  CROSS_DEVICE: {
    statusCode: 422,
    message: 'Destination is on another filesystem; nothing was moved',
  },
  TRASH_UNAVAILABLE: {
    statusCode: 422,
    message: 'This machine has no trash; nothing was deleted',
  },
};

function response(statusCode: number, message: string) {
  return {
    statusCode,
    body: { statusCode, error: STATUS_CODES[statusCode] ?? 'Error', message },
  };
}

export function gitActionReceiptStatus(value: { state: string }): number {
  if (value.state === 'running') return 202;
  if (value.state === 'interrupted') return 503;
  if (value.state === 'rejected' || value.state === 'conflicted') return 409;
  return 200;
}

export function toStatusResponse(error: unknown) {
  if (error instanceof FileInspectionError) {
    const failure = fileFailures[error.code];
    return response(failure.statusCode, failure.message);
  }
  if (error instanceof GitActionRejectedError)
    return response(
      409,
      error.detail ?? 'Git action unavailable; refresh and prepare again',
    );
  if (error instanceof GitActionReceiptMismatchError)
    return response(409, 'Git action request does not match its receipt');
  if (error instanceof GitActionNotFoundError)
    return response(404, 'Git action receipt not found');
  if (error instanceof CommentIdentityConflictError)
    return response(409, error.message);
  if (error instanceof CommitDraftError) return response(422, error.message);
  if (error instanceof UnsupportedGitFiltersError)
    return response(
      422,
      'Git conversion filters are unsupported for worktree inspection',
    );
  if (error instanceof WorktreeNotFoundError)
    return response(404, 'Worktree not found');
  if (
    error instanceof GitActionWorktreeChangedError ||
    error instanceof ChangesWorktreeChangedError
  )
    return response(409, 'Refresh status and retry inspection');
  if (error instanceof InspectionLimitError)
    return response(413, 'Git inspection exceeds its limit');
  if (error instanceof UnsupportedPathEncodingError)
    return response(422, 'Git paths require valid UTF-8');
  if (error instanceof InvalidHistoryRequestError)
    return response(400, 'Invalid history request');
  if (error instanceof HistoryWorktreeUnavailableError)
    return response(422, 'Worktree is unavailable');
  if (error instanceof HistorySnapshotUnavailableError)
    return response(
      422,
      'History snapshot is unavailable; start a new listing',
    );
  if (error instanceof ReadLimitExceededError)
    return response(422, 'History read exceeds its limit');
  if (error instanceof UnsupportedHistoryDataError)
    return response(422, 'History contains unsupported data');
  if (error instanceof ReviewedMarkConflictError)
    return response(
      409,
      'The reviewed mark is based on a version of the file that has changed',
    );
  if (error instanceof ProjectNotFoundError)
    return response(404, 'Project not found');
  if (error instanceof CommentLimitExceededError)
    return response(409, 'Comment capacity exceeded');
  if (error instanceof CommentTargetNotFoundError)
    return response(404, 'Comment target not found');
  if (error instanceof FilePreferenceLimitError)
    return response(409, 'File preference limit reached');
  if (
    error instanceof InvalidFilePreferenceError ||
    error instanceof InvalidCommentError
  )
    return response(400, 'Invalid request');
  if (error instanceof ReviewConflictError)
    return response(409, 'The review changed; reload before retrying');
  if (error instanceof InvalidPairingError) return response(401, error.message);
  if (error instanceof InvalidPairingAddressError)
    return response(400, error.message);
  if (error instanceof InvalidDeviceDetailsError)
    return response(400, error.message);
  if (isInvalidRequest(error)) return response(400, 'Invalid request');
  if (isRepositoryUnavailable(error))
    return response(422, 'Repository could not be inspected');
  if (
    error instanceof ApplicationClosedError ||
    error instanceof GitInspectionTimeoutError ||
    (error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError'))
  )
    return response(503, 'Operation unavailable');
  return response(500, 'Operation failed');
}

function isInvalidRequest(error: unknown) {
  return (
    error instanceof Error &&
    ('validation' in error ||
      ('code' in error &&
        [
          'FST_ERR_CTP_INVALID_JSON_BODY',
          'FST_ERR_CTP_EMPTY_JSON_BODY',
          'FST_ERR_CTP_INVALID_MEDIA_TYPE',
          'FST_ERR_CTP_BODY_TOO_LARGE',
        ].includes(String(error.code))))
  );
}
