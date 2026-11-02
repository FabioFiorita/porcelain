import { Schema } from 'effect';

export class AgentFeedbackConflictError extends Schema.TaggedError<AgentFeedbackConflictError>()(
  'AgentFeedbackConflictError',
  {
    reviewId: Schema.String,
    reason: Schema.Literals([
      'review-inactive',
      'session-missing',
      'session-connected',
      'delivery-mismatch',
      'stale-feedback',
      'delivery-pending',
      'recipient-unavailable',
      'recipient-mismatch',
    ]),
  },
) {
  override get message() {
    switch (this.reason) {
      case 'review-inactive':
        return 'Open the latest active review before connecting or sending feedback';
      case 'session-connected':
        return 'Disconnect the current session before associating another one';
      case 'session-missing':
        return 'Connect a T3 session before sending feedback';
      case 'delivery-mismatch':
        return 'This feedback delivery is no longer current';
      case 'stale-feedback':
        return 'Newer feedback has already been queued';
      case 'delivery-pending':
        return 'The previous send has an unknown result. Acknowledge it or disconnect before sending more feedback';
      case 'recipient-unavailable':
        return 'The associated T3 session is unavailable on this machine';
      case 'recipient-mismatch':
        return 'The associated T3 session belongs to a different worktree';
    }
  }
}
