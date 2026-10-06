import { Schema } from 'effect';
import { beginGitActionInputSchema } from './begin-git-action.ts';

export const queuedGitActionRunSchema = Schema.Struct({
  ...beginGitActionInputSchema.fields,
  kind: Schema.Literal('run'),
});
const queuedGitActionInputSchema = Schema.Union([
  queuedGitActionRunSchema,
  Schema.Struct({
    ...beginGitActionInputSchema.fields,
    kind: Schema.Literal('recover'),
    cause: Schema.Cause(Schema.Never, Schema.Defect()),
  }),
]);
export type QueuedGitActionInput = typeof queuedGitActionInputSchema.Type;
