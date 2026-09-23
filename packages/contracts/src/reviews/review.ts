import { z } from 'zod';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

const idSchema = z.uuid();
const lineSchema = z.number().int().min(1).max(2_147_483_647);
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

export const codePointerSchema = z
  .strictObject({
    path: relativePathSchema,
    startLine: lineSchema,
    endLine: lineSchema,
    symbol: z.string().trim().min(1).max(500).optional(),
  })
  .refine((pointer) => pointer.endLine >= pointer.startLine, {
    message: 'The pointer end must not precede its start',
  });

export const resolvedCodePointerSchema = codePointerSchema.safeExtend({
  textFingerprint: fingerprintSchema,
});

export const stepLocationSchema = z.discriminatedUnion('state', [
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

export const reviewStepSchema = z.strictObject({
  id: idSchema,
  lane: z.number().int().min(0).max(99),
  title: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(4_000),
  kind: z.enum(['changed', 'context']),
  pointer: codePointerSchema,
});

export const resolvedReviewStepSchema = reviewStepSchema.extend({
  pointer: resolvedCodePointerSchema,
  location: stepLocationSchema,
});

const arrowSchema = z.strictObject({
  from: idSchema,
  to: idSchema,
  label: z.string().trim().min(1).max(200).optional(),
});

export const reviewLayerSchema = z.strictObject({
  id: idSchema,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2_000),
  lanes: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
  steps: z.array(reviewStepSchema).min(1).max(500),
  arrows: z.array(arrowSchema).max(500).optional(),
});

export const resolvedReviewLayerSchema = reviewLayerSchema.safeExtend({
  steps: z.array(resolvedReviewStepSchema).min(1).max(500),
  fingerprint: fingerprintSchema,
});

const diagramArrowSchema = z.strictObject({
  from: idSchema,
  to: idSchema,
  label: z.string().trim().min(1).max(200).optional(),
  dashed: z.boolean().optional(),
});
export const diagramBoxSchema = z.strictObject({
  id: idSchema,
  lane: z.number().int().min(0).max(99),
  label: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(1).max(2_000).optional(),
  kind: z.enum(['actor', 'component', 'storage', 'transport', 'credential']),
  change: z.enum(['new', 'changed', 'removed']).optional(),
  problem: z.string().trim().min(1).max(2_000).optional(),
  layerId: idSchema.optional(),
});
export const diagramSchema = z.strictObject({
  lanes: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
  boxes: z.array(diagramBoxSchema).max(500),
  arrows: z.array(diagramArrowSchema).max(1_000),
});
export const reviewDiagramSchema = z.strictObject({
  after: diagramSchema,
  before: diagramSchema.optional(),
});

const summaryHtmlSchema = z
  .string()
  .min(1)
  .max(10 * 1024 * 1024)
  .refine((value) => !LONE_SURROGATE.test(value), 'Expected valid Unicode text')
  .refine(
    (value) => utf8Bytes(value) <= 10 * 1024 * 1024,
    'Summary exceeds 10 MiB',
  );

function utf8Bytes(value: string) {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export const notExplainedSchema = z.object({
  path: relativePathSchema,
  ranges: z.array(z.object({ startLine: lineSchema, endLine: lineSchema })),
  deleted: z.boolean().optional(),
  binary: z.boolean().optional(),
});

export const publishedReviewSchema = z.object({
  environmentId: z.uuid(),
  worktreeId: worktreeIdSchema,
  revision: z.number().int().positive(),
  publishedAt: z.iso.datetime(),
  active: z.boolean(),
  diagnostics: z.enum(['current', 'unavailable']),
  summary: z.object({
    url: z.string().min(1),
    byteLength: z.number().int().positive(),
  }),
  diagram: reviewDiagramSchema.optional(),
  layers: z.array(resolvedReviewLayerSchema).max(100),
  notExplained: z.array(notExplainedSchema).max(2_000),
});

export const publishReviewRequestSchema = z.strictObject({
  expectedRevision: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
  summaryHtml: summaryHtmlSchema,
  diagram: reviewDiagramSchema.optional(),
  layers: z.array(reviewLayerSchema).min(1).max(100),
});

export const readPublishedReviewResponseSchema = z.object({
  review: publishedReviewSchema.nullable(),
});
export const publishReviewResponseSchema = readPublishedReviewResponseSchema;

export type CodePointer = z.output<typeof codePointerSchema>;
export type ResolvedCodePointer = z.output<typeof resolvedCodePointerSchema>;
export type StepLocation = z.output<typeof stepLocationSchema>;
export type ReviewStep = z.output<typeof reviewStepSchema>;
export type ResolvedReviewStep = z.output<typeof resolvedReviewStepSchema>;
export type ReviewLayer = z.output<typeof reviewLayerSchema>;
export type ResolvedReviewLayer = z.output<typeof resolvedReviewLayerSchema>;
export type Diagram = z.output<typeof diagramSchema>;
export type DiagramBox = z.output<typeof diagramBoxSchema>;
export type ReviewDiagram = z.output<typeof reviewDiagramSchema>;
export type NotExplained = z.output<typeof notExplainedSchema>;
export type PublishedReview = z.output<typeof publishedReviewSchema>;
export type PublishReviewRequest = z.output<typeof publishReviewRequestSchema>;
export type PublishReviewResponse = z.output<
  typeof publishReviewResponseSchema
>;
export type ReadPublishedReviewResponse = z.output<
  typeof readPublishedReviewResponseSchema
>;
