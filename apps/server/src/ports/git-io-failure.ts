import type {
  HistorySnapshotUnavailableError,
  HistoryWorktreeUnavailableError,
  InvalidHistoryRequestError,
  ReadLimitExceededError,
  UnsupportedHistoryDataError,
  GitTimeoutError,
  InspectionLimitError,
  InvalidGitDiffError,
  InvalidGitStatusError,
  UnsupportedGitFiltersError,
  UnsupportedPathEncodingError,
} from '@porcelain/git/errors';
import type { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { RepositoryUnavailableError } from '@porcelain/projects/errors';

export type GitIoFailure =
  | HistorySnapshotUnavailableError
  | HistoryWorktreeUnavailableError
  | InvalidHistoryRequestError
  | ReadLimitExceededError
  | UnsupportedHistoryDataError
  | GitTimeoutError
  | InspectionLimitError
  | InvalidGitDiffError
  | InvalidGitStatusError
  | UnsupportedGitFiltersError
  | UnsupportedPathEncodingError
  | WorktreeNotFoundError
  | RepositoryUnavailableError;
