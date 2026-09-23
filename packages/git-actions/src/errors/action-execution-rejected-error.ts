import type { GitActionReason } from '../models/git-action.ts';

export class ActionExecutionRejectedError extends Error {
  readonly reason: GitActionReason;
  readonly detail: string | undefined;

  constructor(reason: GitActionReason, detail?: string) {
    super(detail ?? 'Git action rejected');
    this.reason = reason;
    this.detail = detail;
  }
}
