import { z } from 'zod';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { utf8ByteLength } from '../shared/utf8-bytes.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

const MAX_TEXT_BYTES = 1024 * 1024;

const directoryPathSchema = z.union([z.literal(''), relativePathSchema]);
const editableTextSchema = z
  .string()
  .max(MAX_TEXT_BYTES)
  .refine(
    (text) => !text.includes('\0') && utf8ByteLength(text) <= MAX_TEXT_BYTES,
    'Expected UTF-8 text without NUL within the write limit',
  );

export const listDirectoryQuerySchema = z.strictObject({
  path: directoryPathSchema,
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

export const readTextFileQuerySchema = z.strictObject({
  path: relativePathSchema,
});
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
    path: relativePathSchema,
    text: editableTextSchema,
    expectedFingerprint: fingerprintSchema,
  }),
  z.strictObject({
    kind: z.literal('create'),
    path: relativePathSchema,
    entryKind: z.enum(['file', 'directory']),
  }),
  z.strictObject({
    kind: z.literal('move'),
    path: relativePathSchema,
    destination: relativePathSchema,
  }),
  z.strictObject({ kind: z.literal('trash'), path: relativePathSchema }),
]);
export const editFileResponseSchema = z.object({
  path: z.string(),
  contentFingerprint: fingerprintSchema.optional(),
});

export const readFileAssetQuerySchema = z.strictObject({
  path: relativePathSchema,
});
export const readFileAssetResponseSchema = z.object({
  path: z.string(),
  mediaType: z.string(),
  base64: z.string(),
});

export const readPreviewAssetsRequestSchema = z.strictObject({
  document: relativePathSchema,
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
