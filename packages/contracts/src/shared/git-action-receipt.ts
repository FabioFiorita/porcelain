import { isoDateTimeSchema } from './schema.ts';
import { Schema } from 'effect';
import { oidSchema } from './oid.ts';
import { worktreeIdSchema } from './schema.ts';

export const gitActionSchema = Schema.Literals([
  'fetch',
  'pull',
  'push',
  'commit',
  'amend',
  'stash-create',
  'stash-apply',
  'stash-pop',
  'discard',
]);

export const gitActionReceiptSchema = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID()),
  projectId: Schema.String.check(Schema.isUUID()),
  worktreeId: worktreeIdSchema,
  action: gitActionSchema,
  state: Schema.Literals([
    'running',
    'succeeded',
    'no-change',
    'rejected',
    'conflicted',
    'interrupted',
  ]),
  reason: Schema.optional(
    Schema.Literals([
      'CHANGED_SINCE_LOOKED',
      'STALE_PREPARATION',
      'REQUEST_MISMATCH',
      'CHECKOUT_BUSY',
      'UNSUPPORTED_CONFIGURATION',
      'NON_FAST_FORWARD',
      'GIT_REJECTED',
      'DEADLINE_EXCEEDED',
      'OUTCOME_UNKNOWN',
      'PROCESS_GROUP_UNCONFIRMED',
    ]),
  ),
  message: Schema.optional(Schema.String),
  progress: Schema.Array(Schema.String),
  result: Schema.optional(
    Schema.Struct({
      headOid: Schema.optional(oidSchema),
      trackingOid: Schema.optional(oidSchema),
      sourceOid: Schema.optional(oidSchema),
      destinationRef: Schema.optional(Schema.String),
      stashOid: Schema.optional(oidSchema),
      stashRetained: Schema.optional(Schema.Boolean),
      restoreStashOid: Schema.optional(oidSchema),
      restoreIndex: Schema.optional(Schema.Boolean),
      branch: Schema.optional(Schema.String),
    }),
  ),
  acceptedAt: isoDateTimeSchema,
  finishedAt: Schema.optional(isoDateTimeSchema),
});
