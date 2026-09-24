import { utf8ByteLength } from '@porcelain/kernel/rules';
import { z } from 'zod';
import { absentAsNull } from '../shared/absent-as-null.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import {
  CHANGED_PATHS,
  DIAGRAM_ARROWS,
  DIAGRAM_BOXES,
  LINE_NUMBER_MAX,
  REVIEW_LABEL_LENGTH,
  REVIEW_LANES,
  REVIEW_LANE_NAME_LENGTH,
  REVIEW_LAYERS,
  REVIEW_PROSE_LENGTH,
  REVIEW_STEPS,
  REVIEW_STEP_ARROWS,
  REVIEW_STEP_TEXT_LENGTH,
  REVIEW_SUMMARY_BYTES,
  REVIEW_SUMMARY_MEBIBYTES,
  REVIEW_SYMBOL_LENGTH,
  REVIEW_TITLE_LENGTH,
} from '../shared/limits.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { reviewSummaryLinkSchema } from './review-summary-link.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

const idSchema = z.uuid();
const lineSchema = z.number().int().min(1).max(LINE_NUMBER_MAX);

const codePointerSchema = z.strictObject({
  path: relativePathSchema,
  startLine: lineSchema,
  endLine: lineSchema,
  symbol: z.string().trim().min(1).max(REVIEW_SYMBOL_LENGTH).optional(),
});

const resolvedCodePointerSchema = codePointerSchema.safeExtend({
  textFingerprint: fingerprintSchema,
});

const stepLocationSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('changed') }),
  z.strictObject({
    state: z.literal('current'),
    startLine: lineSchema,
    endLine: lineSchema,
  }),
  z.strictObject({
    state: z.literal('committed'),
    startLine: lineSchema,
    endLine: lineSchema,
  }),
]);

const reviewStepSchema = z.strictObject({
  id: idSchema,
  lane: z
    .number()
    .int()
    .min(0)
    .max(REVIEW_LANES - 1),
  title: z.string().trim().min(1).max(REVIEW_TITLE_LENGTH),
  text: z.string().trim().min(1).max(REVIEW_STEP_TEXT_LENGTH),
  kind: z.enum(['changed', 'context']),
  pointer: codePointerSchema,
});

const resolvedReviewStepSchema = reviewStepSchema.extend({
  pointer: resolvedCodePointerSchema,
  location: stepLocationSchema,
});

const arrowSchema = z.strictObject({
  from: idSchema,
  to: idSchema,
  label: z.string().trim().min(1).max(REVIEW_LABEL_LENGTH).optional(),
});

const reviewLayerSchema = z.strictObject({
  id: idSchema,
  title: z.string().trim().min(1).max(REVIEW_TITLE_LENGTH),
  summary: z.string().trim().min(1).max(REVIEW_PROSE_LENGTH),
  lanes: z
    .array(z.string().trim().min(1).max(REVIEW_LANE_NAME_LENGTH))
    .min(1)
    .max(REVIEW_LANES),
  steps: z.array(reviewStepSchema).min(1).max(REVIEW_STEPS),
  arrows: z.array(arrowSchema).max(REVIEW_STEP_ARROWS).optional(),
});

const resolvedReviewLayerSchema = reviewLayerSchema.safeExtend({
  steps: z.array(resolvedReviewStepSchema).min(1).max(REVIEW_STEPS),
  fingerprint: fingerprintSchema,
});

const diagramArrowSchema = z.strictObject({
  from: idSchema,
  to: idSchema,
  label: z.string().trim().min(1).max(REVIEW_LABEL_LENGTH).optional(),
  dashed: z.boolean().optional(),
});
const diagramBoxSchema = z.strictObject({
  id: idSchema,
  lane: z
    .number()
    .int()
    .min(0)
    .max(REVIEW_LANES - 1),
  label: z.string().trim().min(1).max(REVIEW_LABEL_LENGTH),
  detail: z.string().trim().min(1).max(REVIEW_PROSE_LENGTH).optional(),
  kind: z.enum(['actor', 'component', 'storage', 'transport', 'credential']),
  change: z.enum(['new', 'changed', 'removed']).optional(),
  problem: z.string().trim().min(1).max(REVIEW_PROSE_LENGTH).optional(),
  layerId: idSchema.optional(),
});
const diagramSchema = z.strictObject({
  lanes: z
    .array(z.string().trim().min(1).max(REVIEW_LANE_NAME_LENGTH))
    .min(1)
    .max(REVIEW_LANES),
  boxes: z.array(diagramBoxSchema).max(DIAGRAM_BOXES),
  arrows: z.array(diagramArrowSchema).max(DIAGRAM_ARROWS),
});
const reviewDiagramSchema = z.strictObject({
  after: diagramSchema,
  before: diagramSchema.optional(),
});

const summaryHtmlSchema = z
  .string()
  .min(1)
  .max(REVIEW_SUMMARY_BYTES)
  .refine((value) => value.isWellFormed(), 'Expected valid Unicode text')
  .refine(
    (value) => utf8ByteLength(value) <= REVIEW_SUMMARY_BYTES,
    `Summary exceeds ${REVIEW_SUMMARY_MEBIBYTES} MiB`,
  );

const notExplainedSchema = z.object({
  path: relativePathSchema,
  ranges: z.array(z.object({ startLine: lineSchema, endLine: lineSchema })),
  deleted: z.boolean().optional(),
  binary: z.boolean().optional(),
});

const publishedReviewSchema = z.object({
  environmentId: z.uuid(),
  worktreeId: worktreeIdSchema,
  revision: z.number().int().positive(),
  publishedAt: z.iso.datetime(),
  active: z.boolean(),
  diagnostics: z.enum(['current', 'unavailable']),
  summary: reviewSummaryLinkSchema,
  diagram: reviewDiagramSchema.optional(),
  layers: z.array(resolvedReviewLayerSchema).max(REVIEW_LAYERS),
  notExplained: z.array(notExplainedSchema).max(CHANGED_PATHS),
});

export const publishReviewRequestSchema = z.strictObject({
  expectedRevision: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
  summaryHtml: summaryHtmlSchema,
  diagram: reviewDiagramSchema.optional(),
  layers: z.array(reviewLayerSchema).min(1).max(REVIEW_LAYERS),
});

export const readPublishedReviewResponseSchema = z.object({
  review: absentAsNull(publishedReviewSchema),
});
export const publishReviewResponseSchema = readPublishedReviewResponseSchema;

export type PublishReviewRequest = z.output<typeof publishReviewRequestSchema>;
export type ReadPublishedReviewResponse = z.output<
  typeof readPublishedReviewResponseSchema
>;
