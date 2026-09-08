import { HistorySnapshotUnavailableError } from '@porcelain/git/errors/history-snapshot-unavailable-error';
import { HistoryWorktreeUnavailableError } from '@porcelain/git/errors/history-worktree-unavailable-error';
import { InvalidHistoryRequestError } from '@porcelain/git/errors/invalid-history-request-error';
import { ReadLimitExceededError } from '@porcelain/git/errors/read-limit-exceeded-error';
import { UnsupportedHistoryDataError } from '@porcelain/git/errors/unsupported-history-data-error';
import { WorktreeNotFoundError } from '../../use-cases/errors/worktree-not-found-error.ts';

export function toHistoryErrorResponse(error: unknown) {
  if (error instanceof WorktreeNotFoundError)
    return {
      statusCode: 404,
      body: { code: 'WORKTREE_NOT_FOUND', message: 'Worktree not found' },
    };
  if (error instanceof InvalidHistoryRequestError)
    return {
      statusCode: 400,
      body: { code: 'INVALID_REQUEST', message: 'Invalid history request' },
    };
  if (error instanceof HistoryWorktreeUnavailableError)
    return {
      statusCode: 422,
      body: {
        code: 'REPOSITORY_UNAVAILABLE',
        message: 'Worktree is unavailable',
      },
    };
  if (error instanceof HistorySnapshotUnavailableError)
    return {
      statusCode: 422,
      body: {
        code: 'HISTORY_SNAPSHOT_UNAVAILABLE',
        message: 'History snapshot is unavailable; start a new listing',
      },
    };
  if (error instanceof ReadLimitExceededError)
    return {
      statusCode: 422,
      body: {
        code: 'READ_LIMIT_EXCEEDED',
        message: 'History read exceeds its limit',
      },
    };
  if (error instanceof UnsupportedHistoryDataError)
    return {
      statusCode: 422,
      body: {
        code: 'UNSUPPORTED_HISTORY_DATA',
        message: 'History contains unsupported data',
      },
    };
  return null;
}
