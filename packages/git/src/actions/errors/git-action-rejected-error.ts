import { GitError } from '../../shared/errors/git-error.ts';
import type { GitActionReason } from '../dtos/git-action.ts';

export class GitActionRejectedError extends GitError {
  override readonly name = 'GitActionRejectedError';
  readonly reason: GitActionReason;
  readonly detail: string | undefined;

  constructor(
    reason: GitActionReason,
    options?: ErrorOptions & { detail?: string },
  ) {
    super('Git action rejected', options);
    this.reason = reason;
    this.detail = options?.detail;
  }
}
