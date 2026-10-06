import { Schema } from 'effect';
import { gitActionIntentSchema } from './git-action-intent.ts';
import { gitActionReceiptStateSchema } from './git-action-receipt.ts';

const readQueuedGitActionResultSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('ready'),
    receipt: Schema.Struct({
      requestId: Schema.String,
      acceptedAt: Schema.String,
      projectId: Schema.String,
      worktreeId: Schema.String,
      intent: gitActionIntentSchema,
      state: gitActionReceiptStateSchema,
    }),
  }),
  Schema.Struct({ kind: Schema.Literal('unavailable') }),
]);

export type ReadQueuedGitActionResult =
  typeof readQueuedGitActionResultSchema.Type;
