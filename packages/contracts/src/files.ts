import { z } from 'zod';
import { worktreeIdSchema } from './worktree-id.ts';

export const worktreeParamsSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
});
export const fileQuerySchema = z.strictObject({ path: z.string().max(4096) });
export const directoryResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  path: z.string(),
  entries: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(['file', 'directory', 'symlink', 'submodule', 'other']),
      /** Dimmed in the tree; the folder is never walked to find this out. */
      ignored: z.boolean().optional(),
      /** Where a link points, which is all that is ever read of one. */
      target: z.string().optional(),
    }),
  ),
});
export const worktreePathsSchema = z.object({
  worktreeId: worktreeIdSchema,
  /** Every name quick open can offer, or a refusal if there are too many. */
  paths: z.array(z.string()).max(50_000),
});
export const textResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  path: z.string(),
  encoding: z.literal('utf-8'),
  byteLength: z.number().int().nonnegative(),
  text: z.string(),
  contentFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export type WorktreePaths = z.infer<typeof worktreePathsSchema>;
export type DirectoryResponse = z.infer<typeof directoryResponseSchema>;
export type TextResponse = z.infer<typeof textResponseSchema>;

const editablePath = z.string().min(1).max(4096);
export const fileEditSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('write'),
    path: editablePath,
    text: z.string().max(1048576),
    expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  z.strictObject({
    kind: z.literal('create'),
    path: editablePath,
    entryKind: z.enum(['file', 'directory']),
  }),
  z.strictObject({
    kind: z.literal('move'),
    path: editablePath,
    destination: editablePath,
  }),
  z.strictObject({ kind: z.literal('trash'), path: editablePath }),
]);
export const fileEditResultSchema = z.object({
  path: z.string(),
  contentFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export type FileEdit = z.infer<typeof fileEditSchema>;
export type FileEditResult = z.infer<typeof fileEditResultSchema>;

export const assetResponseSchema = z.object({
  path: z.string(),
  mediaType: z.string(),
  base64: z.string(),
});
export type AssetResponse = z.infer<typeof assetResponseSchema>;
