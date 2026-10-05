import { urlStringSchema } from '../shared/schema.ts';
import { Result, Schema, SchemaTransformation } from 'effect';
import {
  REVIEW_PROOF_ASSETS,
  REVIEW_PROOF_CHECKS,
  REVIEW_PROOF_OUTPUT_LENGTH,
  REVIEW_PROOF_URL_LENGTH,
  REVIEW_TITLE_LENGTH,
} from '../shared/limits.ts';
import { relativePathSchema } from '../shared/relative-path.ts';

const idSchema = Schema.String.check(Schema.isUUID());
const titleSchema = Schema.String.pipe(
  Schema.decode(SchemaTransformation.trim()),
)
  .check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(REVIEW_TITLE_LENGTH));
const targetShape = {
  layerId: Schema.optional(idSchema),
  stepId: Schema.optional(idSchema),
};

const proofMediaTypeSchema = Schema.Literals([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
]);

const proofCheckSchema = Schema.Struct({
  name: titleSchema,
  result: Schema.Literals(['pass', 'fail', 'skipped']),
  output: Schema.optional(
    Schema.String.check(Schema.isMinLength(1)).check(
      Schema.isMaxLength(REVIEW_PROOF_OUTPUT_LENGTH),
    ),
  ),
  ...targetShape,
});

const linkUrlSchema = urlStringSchema
  .check(
    Schema.makeFilter((url: string) => {
      const parsed = Schema.decodeUnknownResult(Schema.URLFromString)(url);
      return (
        Result.isSuccess(parsed) && /^https?:$/.test(parsed.success.protocol)
      );
    }),
  )
  .check(Schema.isMaxLength(REVIEW_PROOF_URL_LENGTH));

const proofFileDraftSchema = <Kind extends 'image' | 'video'>(kind: Kind) =>
  Schema.Struct({
    kind: Schema.Literal(kind),
    title: titleSchema,
    path: Schema.optional(relativePathSchema),
    proofId: Schema.optional(idSchema),
    ...targetShape,
  }).check(
    Schema.makeFilter(
      (asset: {
        readonly path?: string | undefined;
        readonly proofId?: string | undefined;
      }) => (asset.path === undefined) !== (asset.proofId === undefined),
      {
        expected:
          'Name either the path of a new file or the proofId of a published one',
      },
    ),
  );

const proofAssetDraftSchema = Schema.Union([
  proofFileDraftSchema('image'),
  proofFileDraftSchema('video'),
  Schema.Struct({
    kind: Schema.Literal('link'),
    title: titleSchema,
    url: linkUrlSchema,
    ...targetShape,
  }),
]);

export const proofDraftSchema = Schema.Struct({
  checks: Schema.optional(
    Schema.Array(proofCheckSchema).check(
      Schema.isMaxLength(REVIEW_PROOF_CHECKS),
    ),
  ),
  assets: Schema.optional(
    Schema.Array(proofAssetDraftSchema).check(
      Schema.isMaxLength(REVIEW_PROOF_ASSETS),
    ),
  ),
});

const publishedAssetSchema = Schema.Union([
  Schema.Struct({
    id: idSchema,
    kind: Schema.Literals(['image', 'video']),
    title: titleSchema,
    mediaType: proofMediaTypeSchema,
    byteLength: Schema.Number.check(Schema.isInt()).check(
      Schema.isGreaterThan(0),
    ),
    ...targetShape,
  }),
  Schema.Struct({
    id: idSchema,
    kind: Schema.Literal('link'),
    title: titleSchema,
    url: linkUrlSchema,
    ...targetShape,
  }),
]);

export const publishedProofSchema = Schema.Struct({
  checks: Schema.Array(proofCheckSchema).check(
    Schema.isMaxLength(REVIEW_PROOF_CHECKS),
  ),
  assets: Schema.Array(publishedAssetSchema).check(
    Schema.isMaxLength(REVIEW_PROOF_ASSETS),
  ),
  current: Schema.Boolean,
});

export const readProofFileQuerySchema = Schema.Struct({
  proofId: idSchema,
});
export const readProofFileResponseSchema = Schema.Struct({
  id: idSchema,
  mediaType: proofMediaTypeSchema,
  base64: Schema.String,
});

export type ReadProofFileQuery = typeof readProofFileQuerySchema.Type;
export type ReadProofFileResponse = typeof readProofFileResponseSchema.Type;
