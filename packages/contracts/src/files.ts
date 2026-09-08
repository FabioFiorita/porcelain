import { z } from 'zod';

export const worktreeParamsSchema = z.strictObject({ worktreeId: z.uuid() });
export const fileQuerySchema = z.strictObject({ path: z.string().max(4096) });
export const directoryResponseSchema = z.object({
  worktreeId: z.uuid(),
  path: z.string(),
  entries: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(['file', 'directory', 'symlink', 'other']),
    }),
  ),
});
export const textResponseSchema = z.object({
  worktreeId: z.uuid(),
  path: z.string(),
  encoding: z.literal('utf-8'),
  byteLength: z.number().int().nonnegative(),
  text: z.string(),
});
export type DirectoryResponse = z.infer<typeof directoryResponseSchema>;
export type TextResponse = z.infer<typeof textResponseSchema>;
