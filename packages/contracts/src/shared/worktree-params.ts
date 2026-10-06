import { Schema } from 'effect';
import { worktreeIdSchema } from './schema.ts';

export const worktreeParamsSchema = Schema.Struct({
  worktreeId: worktreeIdSchema,
});

export type WorktreeParams = typeof worktreeParamsSchema.Type;
