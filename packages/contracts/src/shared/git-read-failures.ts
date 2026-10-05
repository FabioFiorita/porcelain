import {
  HistorySnapshotUnavailableError,
  HistoryWorktreeUnavailableError,
  InvalidHistoryRequestError,
  ReadLimitExceededError,
  UnsupportedHistoryDataError,
} from '@porcelain/git/errors';
import {
  GitTimeoutError,
  InspectionLimitError,
  InvalidGitDiffError,
  InvalidGitStatusError,
  UnsupportedGitFiltersError,
  UnsupportedPathEncodingError,
} from '@porcelain/git/errors';
import { RepositoryUnavailableError } from '@porcelain/projects/errors';
import { httpFailure } from './http-failure.ts';

export const gitReadFailures = [
  httpFailure(HistorySnapshotUnavailableError, 'UnprocessableEntity', {
    message: 'History snapshot is unavailable; start a new listing',
  }),
  httpFailure(HistoryWorktreeUnavailableError, 'UnprocessableEntity', {
    message: 'Worktree is unavailable',
  }),
  httpFailure(InvalidHistoryRequestError, 'BadRequest'),
  httpFailure(ReadLimitExceededError, 'UnprocessableEntity', {
    message: 'History read exceeds its limit',
  }),
  httpFailure(UnsupportedHistoryDataError, 'UnprocessableEntity', {
    message: 'History contains unsupported data',
  }),
  httpFailure(GitTimeoutError, 'ServiceUnavailable', {
    message: 'Operation unavailable',
  }),
  httpFailure(InspectionLimitError, 'PayloadTooLarge', {
    message: 'Git inspection exceeds its limit',
  }),
  httpFailure(InvalidGitDiffError, 'BadGateway', {
    message: 'Git produced output that could not be read',
  }),
  httpFailure(InvalidGitStatusError, 'BadGateway', {
    message: 'Git produced output that could not be read',
  }),
  httpFailure(UnsupportedGitFiltersError, 'UnprocessableEntity', {
    message: 'Git conversion filters are unsupported for worktree inspection',
  }),
  httpFailure(UnsupportedPathEncodingError, 'UnprocessableEntity', {
    message: 'Git paths require valid UTF-8',
  }),
  httpFailure(RepositoryUnavailableError, 'UnprocessableEntity', {
    message: 'Repository could not be inspected',
  }),
] as const;
