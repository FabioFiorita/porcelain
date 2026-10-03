import { STATUS_CODES } from 'node:http';
import { HttpError } from '@fastify/sensible';
import {
  DeviceNotFoundError,
  InvalidDeviceDetailsError,
  InvalidPairingAddressError,
  InvalidPairingError,
  DeviceViewerRequiredError,
  InvalidTailnetHostnameError,
  InvalidTunnelHostnameError,
  MissingTailnetHostnameError,
  MissingEnvironmentIdentityError,
  MissingTunnelHostnameError,
  NoLocalNetworkError,
  ServiceNotManagedError,
  UnidentifiedLocalNetworkError,
  ServiceUpdateNotOfferedError,
  ServiceUpdateRunningError,
  TooManyPairingAttemptsError,
  TooManyLiveTicketsError,
  UntrustedDeviceError,
} from '@porcelain/access/errors';
import {
  BranchBaseNotFoundError,
  CommitNotFoundError,
  IncompleteDiffReadError,
  SelectionMismatchError,
  UnbornBranchError,
  UnnamedDiffSelectionError,
  UnrelatedBranchError,
} from '@porcelain/changes/errors';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import {
  API_ERROR_STATUS,
  type ApiError,
  type ApiErrorCode,
} from '@porcelain/contracts/shared';
import {
  ContentChangedError,
  CrossDeviceMoveError,
  DirectoryTooLargeError,
  DiskFullError,
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
  CommentAuthorMismatchError,
  CommentIdentityConflictError,
  CommentLimitExceededError,
  CommentRevisionMismatchError,
  CommentTargetNotFoundError,
  DuplicateLayerIdError,
  DuplicateStepIdError,
  ProofFileNotFoundError,
  ProofFileUnreadableError,
  ProofTooLargeError,
  ReviewConflictError,
  ReviewedMarkConflictError,
  ReviewLayerNotFoundError,
  ReviewSummaryNotFoundError,
  StepLaneOutOfRangeError,
  UnknownArrowBoxError,
  UnknownArrowStepError,
  UnknownProofFileError,
  UnknownProofTargetError,
  UnsupportedCommentComparisonError,
  UnsupportedProofFileError,
} from '@porcelain/reviews/errors';
import { errorCodes } from 'fastify';
import { ApplicationClosedError } from '../runtime/errors/application-closed-error.ts';

type ErrorClass = abstract new (...args: never[]) => Error;

type StatusRule = {
  errors: readonly ErrorClass[];
  message?: string;
  withoutBody?: true;
} & (
  | { code: ApiErrorCode; statusCode?: never }
  | { statusCode: number; code?: never }
);

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
      InvalidTunnelHostnameError,
      MissingTunnelHostnameError,
      InvalidTailnetHostnameError,
      MissingTailnetHostnameError,
      InvalidHistoryRequestError,
      UnknownProofTargetError,
      UnknownProofFileError,
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
      UnsupportedCommentComparisonError,
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
      CommentAuthorMismatchError,
      DeviceViewerRequiredError,
      UntrustedDeviceError,
    ],
    statusCode: 403,
  },
  {
    errors: [
      WorktreeNotFoundError,
      ReviewLayerNotFoundError,
      ProofFileNotFoundError,
      ProjectNotFoundError,
      CommitNotFoundError,
      BranchBaseNotFoundError,
      PathNotFoundError,
      FolderNotFoundError,
      GitActionNotFoundError,
      NoWorktreeAtPathError,
      DeviceNotFoundError,
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
    message: 'Refresh status and retry inspection',
    code: 'worktree_changed',
  },
  { errors: [ContentChangedError], code: 'content_changed' },
  {
    errors: [
      EntryExistsError,
      CommentIdentityConflictError,
      ReviewedMarkConflictError,
      UnrelatedBranchError,
      UnbornBranchError,
      ServiceNotManagedError,
      ServiceUpdateNotOfferedError,
      ServiceUpdateRunningError,
      NoLocalNetworkError,
      UnidentifiedLocalNetworkError,
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
  {
    errors: [errorCodes.FST_ERR_CTP_BODY_TOO_LARGE, ProofTooLargeError],
    statusCode: 413,
  },
  {
    errors: [TooManyPairingAttemptsError, TooManyLiveTicketsError],
    statusCode: 429,
  },
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
      DirectoryTooLargeError,
      CrossDeviceMoveError,
      TrashUnavailableError,
      UnsupportedAssetTypeError,
      ProofFileUnreadableError,
      UnsupportedProofFileError,
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
  { errors: [UnsupportedTextError], code: 'unsupported_text' },
  { errors: [FileTooLargeError], code: 'file_too_large' },
  {
    errors: [DiskFullError],
    statusCode: 422,
    message: 'There is not enough space on the disk',
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

function response(
  statusCode: number,
  message: string,
  code?: ApiErrorCode,
): StatusResponse {
  return {
    statusCode,
    body: {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
      ...(code ? { code } : {}),
    },
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
    if (rule) {
      const statusCode =
        rule.code === undefined ? rule.statusCode : API_ERROR_STATUS[rule.code];
      if (rule.withoutBody) return { statusCode, body: undefined };
      return response(statusCode, rule.message ?? error.message, rule.code);
    }
    if ('validation' in error) return response(400, INVALID_REQUEST);
  }
  if (isRepositoryUnavailable(error))
    return response(422, REPOSITORY_UNAVAILABLE);
  if (isAbandoned(error)) return response(503, OPERATION_UNAVAILABLE);
  return response(500, 'Operation failed');
}

export function abandonedByClient(
  error: unknown,
  clientGone: boolean,
): boolean {
  return (
    clientGone && error instanceof DOMException && error.name === 'AbortError'
  );
}

function isAbandoned(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}
