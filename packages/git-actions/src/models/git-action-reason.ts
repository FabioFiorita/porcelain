import { Schema } from 'effect';
export const gitActionReasonSchema = Schema.Union([
  Schema.Literal('CHANGED_SINCE_LOOKED'),
  Schema.Literal('STALE_PREPARATION'),
  Schema.Literal('REQUEST_MISMATCH'),
  Schema.Literal('CHECKOUT_BUSY'),
  Schema.Literal('UNSUPPORTED_CONFIGURATION'),
  Schema.Literal('NON_FAST_FORWARD'),
  Schema.Literal('GIT_REJECTED'),
  Schema.Literal('DEADLINE_EXCEEDED'),
  Schema.Literal('OUTCOME_UNKNOWN'),
  Schema.Literal('PROCESS_GROUP_UNCONFIRMED'),
]);

export type GitActionReason = typeof gitActionReasonSchema.Type;
