import { z } from 'zod';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

export const resolveWorktreeByPathRequestSchema = z.strictObject({
  path: z.string().min(1).max(4096),
});
export const resolveWorktreeByPathResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
});

export type ResolveWorktreeByPathRequest = z.output<
  typeof resolveWorktreeByPathRequestSchema
>;
export type ResolveWorktreeByPathResponse = z.output<
  typeof resolveWorktreeByPathResponseSchema
>;
