import { z } from 'zod';
import {
  REVIEW_PROOF_ASSETS,
  REVIEW_PROOF_CHECKS,
  REVIEW_PROOF_OUTPUT_LENGTH,
  REVIEW_PROOF_URL_LENGTH,
  REVIEW_TITLE_LENGTH,
} from '../shared/limits.ts';
import { relativePathSchema } from '../shared/relative-path.ts';

const idSchema = z.uuid();
const titleSchema = z.string().trim().min(1).max(REVIEW_TITLE_LENGTH);
const targetShape = {
  layerId: idSchema.optional(),
  stepId: idSchema.optional(),
};

const proofMediaTypeSchema = z.enum([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
]);

const proofCheckSchema = z.strictObject({
  name: titleSchema,
  result: z.enum(['pass', 'fail', 'skipped']),
  output: z.string().min(1).max(REVIEW_PROOF_OUTPUT_LENGTH).optional(),
  ...targetShape,
});

const linkUrlSchema = z
  .url({ protocol: /^https?$/ })
  .max(REVIEW_PROOF_URL_LENGTH);

const proofAssetDraftSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('image'),
    title: titleSchema,
    path: relativePathSchema,
    ...targetShape,
  }),
  z.strictObject({
    kind: z.literal('video'),
    title: titleSchema,
    path: relativePathSchema,
    ...targetShape,
  }),
  z.strictObject({
    kind: z.literal('link'),
    title: titleSchema,
    url: linkUrlSchema,
    ...targetShape,
  }),
]);

export const proofDraftSchema = z.strictObject({
  checks: z.array(proofCheckSchema).max(REVIEW_PROOF_CHECKS).optional(),
  assets: z.array(proofAssetDraftSchema).max(REVIEW_PROOF_ASSETS).optional(),
});

const publishedAssetSchema = z.discriminatedUnion('kind', [
  z.object({
    id: idSchema,
    kind: z.enum(['image', 'video']),
    title: titleSchema,
    mediaType: proofMediaTypeSchema,
    byteLength: z.number().int().positive(),
    ...targetShape,
  }),
  z.object({
    id: idSchema,
    kind: z.literal('link'),
    title: titleSchema,
    url: linkUrlSchema,
    ...targetShape,
  }),
]);

export const publishedProofSchema = z.object({
  checks: z.array(proofCheckSchema).max(REVIEW_PROOF_CHECKS),
  assets: z.array(publishedAssetSchema).max(REVIEW_PROOF_ASSETS),
});

export const readProofFileQuerySchema = z.strictObject({
  proofId: idSchema,
});
export const readProofFileResponseSchema = z.object({
  id: idSchema,
  mediaType: proofMediaTypeSchema,
  base64: z.string(),
});

export type ReadProofFileQuery = z.output<typeof readProofFileQuerySchema>;
export type ReadProofFileResponse = z.output<
  typeof readProofFileResponseSchema
>;
