import { Schema } from 'effect';

const queueGitActionInputSchema = Schema.Struct({ requestId: Schema.String });
export type QueueGitActionInput = typeof queueGitActionInputSchema.Type;
