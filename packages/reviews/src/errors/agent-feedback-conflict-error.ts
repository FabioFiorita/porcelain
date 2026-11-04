import { Schema } from 'effect';

export class AgentFeedbackConflictError extends Schema.TaggedError<AgentFeedbackConflictError>()(
  'AgentFeedbackConflictError',
  {
    detail: Schema.optional(
      Schema.Literals([
        'command-missing',
        'deadline',
        'command-failed',
        'protocol',
        'archived',
        'pending-input',
      ]),
    ),
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
        if (this.detail)
          return {
            'command-missing':
              'The T3 command is not available to the Porcelain server. Add it to the server’s PATH.',
            deadline:
              'T3 did not answer before the command deadline. The review and comments are saved.',
            'command-failed':
              'The T3 command failed. Check that T3 is running on this machine.',
            protocol:
              'T3 returned an unsupported response. Update the T3 command to match its server.',
            archived:
              'This T3 thread is archived. Reopen it before connecting.',
            'pending-input':
              'This T3 thread is waiting for an answer. Answer it before sending feedback.',
          }[this.detail];
        return 'The associated T3 session is unavailable on this machine';
      case 'recipient-mismatch':
        return 'The associated T3 session belongs to a different worktree';
    }
  }
}
