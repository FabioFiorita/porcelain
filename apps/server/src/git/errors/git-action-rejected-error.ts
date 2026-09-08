import type { GitActionReason } from '../../models/git-action.ts';

export class GitActionRejectedError extends Error {
  readonly reason: GitActionReason;
  constructor(reason: GitActionReason, options?: ErrorOptions) {
    super('Git action rejected', options);
    this.reason = reason;
  }
}
