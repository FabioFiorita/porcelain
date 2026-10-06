import type { HistorySnapshotUnavailableError } from './history-snapshot-unavailable-error.ts';
import type { HistoryWorktreeUnavailableError } from './history-worktree-unavailable-error.ts';
import type { InvalidHistoryRequestError } from './invalid-history-request-error.ts';
import type { ReadLimitExceededError } from './read-limit-exceeded-error.ts';
import type { UnsupportedHistoryDataError } from './unsupported-history-data-error.ts';
import type { GitTimeoutError } from './git-timeout-error.ts';
import type { InspectionLimitError } from './inspection-limit-error.ts';
import type { InvalidGitDiffError } from './invalid-git-diff-error.ts';
import type { InvalidGitStatusError } from './invalid-git-status-error.ts';
import type { UnsupportedGitFiltersError } from './unsupported-git-filters-error.ts';
import type { UnsupportedPathEncodingError } from './unsupported-path-encoding-error.ts';
import type { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { RepositoryUnavailableError } from '@porcelain/kernel/errors';

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
