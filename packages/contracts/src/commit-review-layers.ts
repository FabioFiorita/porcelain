import { z } from 'zod';
import { commitOidSchema } from './commit-history.ts';
import { reviewLayersResponseSchema } from './review-layers.ts';

const layersSchema = reviewLayersResponseSchema.shape.layers;
const referenceSchema = layersSchema.element.shape.files.element;
export const commitReviewLayerParamsSchema = z.strictObject({
  projectId: z.uuid(),
  oid: commitOidSchema,
});
export const associateCommitReviewLayersSchema = z.strictObject({
  sourceWorktreeId: z.uuid(),
  sourceRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  parentNumber: z.number().int().min(1).max(1000).default(1),
  references: z
    .array(referenceSchema)
    .min(1)
    .max(500)
    .refine(
      (references) =>
        new Set(references.map((reference) => reference.path)).size ===
        references.length,
      'A committed path may be assigned only once',
    ),
});
export const commitReviewLayersResponseSchema = z.strictObject({
  projectId: z.uuid(),
  commitOid: commitOidSchema,
  sourceWorktreeId: z.uuid(),
  sourceRevision: z.number().int().positive(),
  parentNumber: z.number().int().positive(),
  layers: layersSchema,
});
