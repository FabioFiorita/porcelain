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
  contentFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
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

export const fileTreeSchema = z.object({
  worktreeId: z.uuid(),
  entries: z.array(
    z.object({
      path: z.string(),
      kind: z.enum(['file', 'directory', 'symlink', 'submodule', 'other']),
      ignored: z.boolean(),
      target: z.string().optional(),
    }),
  ),
});
export type FileTree = z.infer<typeof fileTreeSchema>;
