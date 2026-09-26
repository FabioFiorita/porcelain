import { z } from 'zod';
import { WORKTREE_ID_LENGTH } from './limits.ts';

export const worktreeIdSchema = z
  .string()
  .regex(new RegExp(`^[0-9a-f]{${WORKTREE_ID_LENGTH}}$`));
export const worktreeParamsSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
});

export type WorktreeParams = z.output<typeof worktreeParamsSchema>;
