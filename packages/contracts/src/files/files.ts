import { z } from 'zod';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

const filePathSchema = z.string().max(4096);
const editablePathSchema = z.string().min(1).max(4096);

export const listDirectoryQuerySchema = z.strictObject({
  path: filePathSchema,
});
export const listDirectoryResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  path: z.string(),
  entries: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(['file', 'directory', 'symlink', 'submodule', 'other']),
      ignored: z.boolean().optional(),
      target: z.string().optional(),
    }),
  ),
});

export const listWorktreePathsResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  paths: z.array(z.string()).max(50_000),
});

export const readTextFileQuerySchema = z.strictObject({ path: filePathSchema });
export const readTextFileResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  path: z.string(),
  encoding: z.literal('utf-8'),
  byteLength: z.number().int().nonnegative(),
  text: z.string(),
  contentFingerprint: fingerprintSchema.optional(),
});

export const editFileRequestSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('write'),
    path: editablePathSchema,
    text: z.string().max(1048576),
    expectedFingerprint: fingerprintSchema,
  }),
  z.strictObject({
    kind: z.literal('create'),
    path: editablePathSchema,
    entryKind: z.enum(['file', 'directory']),
  }),
  z.strictObject({
    kind: z.literal('move'),
    path: editablePathSchema,
    destination: editablePathSchema,
  }),
  z.strictObject({ kind: z.literal('trash'), path: editablePathSchema }),
]);
export const editFileResponseSchema = z.object({
  path: z.string(),
  contentFingerprint: fingerprintSchema.optional(),
});

export const readFileAssetQuerySchema = z.strictObject({
  path: filePathSchema,
});
export const readFileAssetResponseSchema = z.object({
  path: z.string(),
  mediaType: z.string(),
  base64: z.string(),
});

export const readPreviewAssetsRequestSchema = z.strictObject({
  document: z.string().max(4096),
  paths: z.array(z.string().max(4096)).min(1).max(64),
});
export const readPreviewAssetsResponseSchema = z.object({
  assets: z.array(
    z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('asset'),
        path: z.string(),
        mediaType: z.string(),
        base64: z.string(),
      }),
      z.object({ kind: z.literal('unavailable'), path: z.string() }),
    ]),
  ),
});

export type ListDirectoryQuery = z.output<typeof listDirectoryQuerySchema>;
export type ListDirectoryResponse = z.output<
  typeof listDirectoryResponseSchema
>;
export type ListWorktreePathsResponse = z.output<
  typeof listWorktreePathsResponseSchema
>;
export type ReadTextFileQuery = z.output<typeof readTextFileQuerySchema>;
export type ReadTextFileResponse = z.output<typeof readTextFileResponseSchema>;
export type EditFileRequest = z.output<typeof editFileRequestSchema>;
export type EditFileResponse = z.output<typeof editFileResponseSchema>;
export type ReadFileAssetQuery = z.output<typeof readFileAssetQuerySchema>;
export type ReadFileAssetResponse = z.output<
  typeof readFileAssetResponseSchema
>;
export type ReadPreviewAssetsRequest = z.output<
  typeof readPreviewAssetsRequestSchema
>;
export type ReadPreviewAssetsResponse = z.output<
  typeof readPreviewAssetsResponseSchema
>;
