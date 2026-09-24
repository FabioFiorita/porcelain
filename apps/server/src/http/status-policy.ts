import { STATUS_CODES } from 'node:http';
import { HttpError } from '@fastify/sensible';
import {
  InvalidDeviceDetailsError,
  InvalidPairingAddressError,
  InvalidPairingError,
  MissingEnvironmentIdentityError,
  TooManyPairingAttemptsError,
} from '@porcelain/access/errors';
import {
  CommitNotFoundError,
  IncompleteDiffReadError,
  SelectionMismatchError,
  UnnamedDiffSelectionError,
} from '@porcelain/changes/errors';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import type { ApiError } from '@porcelain/contracts/shared';
import {
  ContentChangedError,
  CrossDeviceMoveError,
  DirectoryTooLargeError,
  EntryExistsError,
  FileTooLargeError,
  InvalidMoveError,
  PathNotFoundError,
  PathNotReadableError,
  TrashUnavailableError,
  UnsupportedAssetTypeError,
  UnsupportedEntryNameError,
  UnsupportedTextError,
} from '@porcelain/files/errors';
import {
  CommitDraftSelectionError,
  CommitDraftTooLargeError,
  CommitGenerationFailedError,
  CommitGroupsMismatchError,
  CommitToolFailedError,
  CommitToolMissingError,
  DiscardExpectationMismatchError,
  DuplicateExpectedFileError,
  EmptyCommitSelectionError,
  ExpectedFilesMismatchError,
  GitActionNotFoundError,
  GitActionReceiptMismatchError,
  InvalidHunkRangeError,
  MergeExpectationMismatchError,
  MissingExpectedFilesError,
  MissingUpstreamExpectationError,
  UnsupportedCommitModelError,
} from '@porcelain/git-actions/errors';
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
  GitTimeoutError,
  InspectionLimitError,
  InvalidGitDiffError,
  InvalidGitStatusError,
  UnsupportedGitFiltersError,
  UnsupportedPathEncodingError,
} from '@porcelain/git/inspection';
import {
  InvalidLineRangeError,
  WorktreeChangedError,
  WorktreeNotFoundError,
} from '@porcelain/kernel/errors';
import {
  FilePreferenceLimitError,
  FolderNotFoundError,
  FolderNotReadableError,
  NoWorktreeAtPathError,
  ProjectNotFoundError,
  RepositoryUnavailableError,
  UnsupportedFolderNameError,
  WorktreeUnavailableError,
} from '@porcelain/projects/errors';
import {
  BoxLaneOutOfRangeError,
  CommentIdentityConflictError,
  CommentLimitExceededError,
  CommentRevisionMismatchError,
  CommentTargetNotFoundError,
  DuplicateLayerIdError,
  DuplicateStepIdError,
  ReviewConflictError,
  ReviewedMarkConflictError,
  ReviewLayerNotFoundError,
  ReviewSummaryNotFoundError,
  StepLaneOutOfRangeError,
  UnknownArrowBoxError,
  UnknownArrowStepError,
} from '@porcelain/reviews/errors';
import { errorCodes } from 'fastify';
import { ApplicationClosedError } from '../runtime/errors/application-closed-error.ts';

type ErrorClass = abstract new (...args: never[]) => Error;

type StatusRule = {
  errors: readonly ErrorClass[];
  statusCode: number;
  message?: string;
  withoutBody?: true;
};

type StatusResponse = {
  statusCode: number;
  body: ApiError | undefined;
};

const INVALID_REQUEST = 'Invalid request';
const REPOSITORY_UNAVAILABLE = 'Repository could not be inspected';
const OPERATION_UNAVAILABLE = 'Operation unavailable';

const rules: readonly StatusRule[] = [
  {
    errors: [
      InvalidPairingAddressError,
      InvalidDeviceDetailsError,
      InvalidHistoryRequestError,
    ],
    statusCode: 400,
  },
  {
    errors: [
      errorCodes.FST_ERR_CTP_INVALID_JSON_BODY,
      errorCodes.FST_ERR_CTP_EMPTY_JSON_BODY,
      errorCodes.FST_ERR_CTP_INVALID_MEDIA_TYPE,
      SelectionMismatchError,
      InvalidLineRangeError,
      UnnamedDiffSelectionError,
      InvalidHunkRangeError,
      CommentRevisionMismatchError,
      InvalidMoveError,
      DuplicateExpectedFileError,
      MergeExpectationMismatchError,
      EmptyCommitSelectionError,
      ExpectedFilesMismatchError,
      DiscardExpectationMismatchError,
      MissingExpectedFilesError,
      MissingUpstreamExpectationError,
      DuplicateStepIdError,
      StepLaneOutOfRangeError,
      UnknownArrowStepError,
      BoxLaneOutOfRangeError,
      UnknownArrowBoxError,
      DuplicateLayerIdError,
    ],
    statusCode: 400,
    message: INVALID_REQUEST,
  },
  { errors: [InvalidPairingError], statusCode: 401 },
  {
    errors: [
      WorktreeNotFoundError,
      ReviewLayerNotFoundError,
      ProjectNotFoundError,
      CommitNotFoundError,
      PathNotFoundError,
      FolderNotFoundError,
      GitActionNotFoundError,
      NoWorktreeAtPathError,
    ],
    statusCode: 404,
  },
  { errors: [ReviewSummaryNotFoundError], statusCode: 404, withoutBody: true },
  {
    errors: [CommentTargetNotFoundError],
    statusCode: 404,
    message: 'Comment target not found',
  },
  {
    errors: [WorktreeChangedError],
    statusCode: 409,
    message: 'Refresh status and retry inspection',
  },
  {
    errors: [
      EntryExistsError,
      ContentChangedError,
      CommentIdentityConflictError,
      ReviewedMarkConflictError,
    ],
    statusCode: 409,
  },
  {
    errors: [GitActionReceiptMismatchError],
    statusCode: 409,
    message: 'Git action request does not match its receipt',
  },
  {
    errors: [CommentLimitExceededError],
    statusCode: 409,
    message: 'Comment capacity exceeded',
  },
  {
    errors: [FilePreferenceLimitError],
    statusCode: 409,
    message: 'File preference limit reached',
  },
  {
    errors: [ReviewConflictError],
    statusCode: 409,
    message: 'The review changed; reload before retrying',
  },
  { errors: [errorCodes.FST_ERR_CTP_BODY_TOO_LARGE], statusCode: 413 },
  { errors: [TooManyPairingAttemptsError], statusCode: 429 },
  {
    errors: [InspectionLimitError],
    statusCode: 413,
    message: 'Git inspection exceeds its limit',
  },
  {
    errors: [WorktreeUnavailableError, RepositoryUnavailableError],
    statusCode: 422,
    message: REPOSITORY_UNAVAILABLE,
  },
  {
    errors: [
      IncompleteDiffReadError,
      PathNotReadableError,
      FolderNotReadableError,
      UnsupportedEntryNameError,
      UnsupportedFolderNameError,
      UnsupportedTextError,
      FileTooLargeError,
      DirectoryTooLargeError,
      CrossDeviceMoveError,
      TrashUnavailableError,
      UnsupportedAssetTypeError,
      CommitDraftSelectionError,
      CommitDraftTooLargeError,
      CommitGenerationFailedError,
      CommitGroupsMismatchError,
      CommitToolFailedError,
      CommitToolMissingError,
      UnsupportedCommitModelError,
    ],
    statusCode: 422,
  },
  {
    errors: [GitActionRejectedError],
    statusCode: 422,
    message: 'Git refused the operation; refresh and try again',
  },
  {
    errors: [UnsupportedGitFiltersError],
    statusCode: 422,
    message: 'Git conversion filters are unsupported for worktree inspection',
  },
  {
    errors: [UnsupportedPathEncodingError],
    statusCode: 422,
    message: 'Git paths require valid UTF-8',
  },
  {
    errors: [HistoryWorktreeUnavailableError],
    statusCode: 422,
    message: 'Worktree is unavailable',
  },
  {
    errors: [HistorySnapshotUnavailableError],
    statusCode: 422,
    message: 'History snapshot is unavailable; start a new listing',
  },
  {
    errors: [ReadLimitExceededError],
    statusCode: 422,
    message: 'History read exceeds its limit',
  },
  {
    errors: [UnsupportedHistoryDataError],
    statusCode: 422,
    message: 'History contains unsupported data',
  },
  {
    errors: [InvalidGitDiffError, InvalidGitStatusError],
    statusCode: 502,
    message: 'Git produced output that could not be read',
  },
  {
    errors: [
      ApplicationClosedError,
      GitTimeoutError,
      MissingEnvironmentIdentityError,
    ],
    statusCode: 503,
    message: OPERATION_UNAVAILABLE,
  },
];

function response(statusCode: number, message: string): StatusResponse {
  return {
    statusCode,
    body: { statusCode, error: STATUS_CODES[statusCode] ?? 'Error', message },
  };
}

export function gitActionReceiptStatus(
  receipt: Pick<RunGitActionResponse, 'state'>,
): number {
  if (receipt.state === 'running') return 202;
  if (receipt.state === 'interrupted') return 503;
  if (receipt.state === 'rejected' || receipt.state === 'conflicted')
    return 409;
  return 200;
}

function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function toStatusResponse(error: unknown): StatusResponse {
  if (isHttpError(error)) return response(error.statusCode, error.message);
  if (error instanceof Error) {
    const rule = rules.find((entry) =>
      entry.errors.some((errorClass) => error instanceof errorClass),
    );
    if (rule?.withoutBody)
      return { statusCode: rule.statusCode, body: undefined };
    if (rule) return response(rule.statusCode, rule.message ?? error.message);
    if ('validation' in error) return response(400, INVALID_REQUEST);
  }
  if (isRepositoryUnavailable(error))
    return response(422, REPOSITORY_UNAVAILABLE);
  if (isAbandoned(error)) return response(503, OPERATION_UNAVAILABLE);
  return response(500, 'Operation failed');
}

function isAbandoned(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}
