import { GitError } from '../../shared/errors/git-error.ts';

export class HistorySnapshotUnavailableError extends GitError {
  override readonly name = 'HistorySnapshotUnavailableError';

  constructor(options?: ErrorOptions) {
    super('History snapshot is unavailable', options);
  }
}
