import type { GitActionReason } from '../dtos/git-action.ts';

export class GitActionRejectedError extends Error {
  readonly reason: GitActionReason;
  readonly detail: string | undefined;
  constructor(
    reason: GitActionReason,
    options?: ErrorOptions & { detail?: string },
  ) {
    super(options?.detail ?? 'Git action rejected', options);
    this.reason = reason;
    this.detail = options?.detail;
  }
}
