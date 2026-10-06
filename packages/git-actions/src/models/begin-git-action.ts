import { Schema } from 'effect';
import { gitActionRunSchema } from './git-action-run.ts';

export const beginGitActionInputSchema = Schema.Struct({
  requestId: Schema.String,
  acceptedAt: Schema.String,
});
const beginGitActionResultSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('ready'), run: gitActionRunSchema }),
  Schema.Struct({ kind: Schema.Literal('unavailable') }),
]);
export type BeginGitActionInput = typeof beginGitActionInputSchema.Type;
export type BeginGitActionResult = typeof beginGitActionResultSchema.Type;
