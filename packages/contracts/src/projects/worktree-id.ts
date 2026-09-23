import { z } from 'zod';

export const worktreeIdSchema = z.string().regex(/^[0-9a-f]{32}$/);
