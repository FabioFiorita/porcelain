import { z } from 'zod';

export const worktreeIdSchema = z.string().regex(/^[0-9a-f]{32}$/);
export const worktreeParamsSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
});

export type WorktreeId = z.output<typeof worktreeIdSchema>;
export type WorktreeParams = z.output<typeof worktreeParamsSchema>;
