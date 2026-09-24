import { z } from 'zod';
import { worktreeIdSchema } from '../shared/worktree-params.ts';
import { PATH_LENGTH } from '../shared/limits.ts';

export const findWorktreeByPathRequestSchema = z.strictObject({
  path: z.string().min(1).max(PATH_LENGTH),
});
export const findWorktreeByPathResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
});

export type FindWorktreeByPathRequest = z.output<
  typeof findWorktreeByPathRequestSchema
>;
export type FindWorktreeByPathResponse = z.output<
  typeof findWorktreeByPathResponseSchema
>;
