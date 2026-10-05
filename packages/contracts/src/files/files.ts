import { Schema } from 'effect';
import { worktreeIdSchema } from '../shared/schema.ts';
import {
  PATH_LENGTH,
  PREVIEW_ASSETS,
  TEXT_BYTES,
  WORKTREE_PATHS,
} from '../shared/limits.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { utf8ByteLength } from '../shared/utf8-byte-length.ts';

const directoryPath = Schema.Union([Schema.Literal(''), relativePathSchema]);
const editableText = Schema.String.check(
  Schema.makeFilter(
    (text: string) =>
      text.length <= TEXT_BYTES &&
      !text.includes('\0') &&
      utf8ByteLength(text) <= TEXT_BYTES,
    { expected: 'UTF-8 text without NUL within the write limit' },
  ),
);

export const listDirectoryQuerySchema = Schema.Struct({ path: directoryPath });
export const listDirectoryResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    worktreeId: worktreeIdSchema,
    path: Schema.String,
    entries: Schema.Array(
      Schema.Struct({
        name: Schema.String,
        kind: Schema.Literals([
          'file',
          'directory',
          'symlink',
          'submodule',
          'other',
        ]),
        ignored: Schema.optional(Schema.Boolean),
        target: Schema.optional(Schema.String),
      }),
    ),
  }),
);

export const listWorktreePathsResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    worktreeId: worktreeIdSchema,
    paths: Schema.Array(Schema.String).check(
      Schema.isMaxLength(WORKTREE_PATHS),
    ),
  }),
);

export const readTextFileQuerySchema = Schema.Struct({
  path: relativePathSchema,
});
export const readTextFileResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    worktreeId: worktreeIdSchema,
    path: Schema.String,
    encoding: Schema.Literal('utf-8'),
    byteLength: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    text: Schema.String,
    contentFingerprint: Schema.optional(fingerprintSchema),
  }),
);

export const editFileRequestSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('write'),
    path: relativePathSchema,
    text: editableText,
    expectedFingerprint: fingerprintSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal('create'),
    path: relativePathSchema,
    entryKind: Schema.Literals(['file', 'directory']),
  }),
  Schema.Struct({
    kind: Schema.Literal('move'),
    path: relativePathSchema,
    destination: relativePathSchema,
  }),
  Schema.Struct({ kind: Schema.Literal('trash'), path: relativePathSchema }),
  Schema.Struct({
    kind: Schema.Literal('copy'),
    path: relativePathSchema,
    destination: relativePathSchema,
  }),
]);
export const editFileResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    path: Schema.String,
    contentFingerprint: Schema.optional(fingerprintSchema),
  }),
);

export const readFileAssetQuerySchema = Schema.Struct({
  path: relativePathSchema,
});
export const readFileAssetResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    path: Schema.String,
    mediaType: Schema.String,
    base64: Schema.String,
  }),
);

export const readPreviewAssetsRequestSchema = Schema.Struct({
  document: relativePathSchema,
  paths: Schema.Array(
    Schema.String.check(Schema.isMaxLength(PATH_LENGTH)),
  ).check(Schema.isMinLength(1), Schema.isMaxLength(PREVIEW_ASSETS)),
});
export const readPreviewAssetsResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    assets: Schema.Array(
      Schema.Union([
        Schema.Struct({
          kind: Schema.Literal('asset'),
          path: Schema.String,
          mediaType: Schema.String,
          base64: Schema.String,
        }),
        Schema.Struct({
          kind: Schema.Literal('unavailable'),
          path: Schema.String,
        }),
      ]),
    ),
  }),
);

export type ListDirectoryQuery = typeof listDirectoryQuerySchema.Type;
export type ListDirectoryResponse = typeof listDirectoryResponseSchema.Type;
export type ReadTextFileQuery = typeof readTextFileQuerySchema.Type;
export type ReadFileAssetQuery = typeof readFileAssetQuerySchema.Type;
export type ReadPreviewAssetsRequest =
  typeof readPreviewAssetsRequestSchema.Type;
export type ReadFileAssetResponse = typeof readFileAssetResponseSchema.Type;
export type ReadTextFileResponse = typeof readTextFileResponseSchema.Type;
export type ListWorktreePathsResponse =
  typeof listWorktreePathsResponseSchema.Type;
export type ReadPreviewAssetsResponse =
  typeof readPreviewAssetsResponseSchema.Type;
export type EditFileResponse = typeof editFileResponseSchema.Type;
export type EditFileRequest = typeof editFileRequestSchema.Type;
