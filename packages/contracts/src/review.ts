import { z } from 'zod';
import { gitPathSchema } from './git-status.ts';
import { fingerprintSchema } from './reviewed-files.ts';
import { worktreeIdSchema } from './worktree-id.ts';

const idSchema = z.uuid();
const lineSchema = z.number().int().min(1).max(2_147_483_647);

export const codePointerInputSchema = z
  .strictObject({
    path: gitPathSchema,
    startLine: lineSchema,
    endLine: lineSchema,
    symbol: z.string().trim().min(1).max(500).optional(),
  })
  .refine((pointer) => pointer.endLine >= pointer.startLine, {
    message: 'The pointer end must not precede its start',
  });

export const codePointerSchema = codePointerInputSchema.safeExtend({
  /** SHA-256 of the exact UTF-8 lines captured when the review was published. */
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

const stepInputSchema = z.strictObject({
  id: idSchema,
  lane: z.number().int().min(0).max(99),
  title: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(4_000),
  kind: z.enum(['changed', 'context']),
  pointer: codePointerInputSchema,
});

export const reviewStepSchema = stepInputSchema.extend({
  pointer: codePointerSchema,
  location: stepLocationSchema,
});

const arrowSchema = z.strictObject({
  from: idSchema,
  to: idSchema,
  label: z.string().trim().min(1).max(200).optional(),
});

const layerInputSchema = z
  .strictObject({
    id: idSchema,
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().min(1).max(2_000),
    lanes: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
    steps: z.array(stepInputSchema).min(1).max(500),
    arrows: z.array(arrowSchema).max(500).optional(),
  })
  .superRefine((layer, context) => {
    const ids = new Set<string>();
    for (const step of layer.steps) {
      if (ids.has(step.id))
        context.addIssue({ code: 'custom', message: 'Duplicate step ID' });
      ids.add(step.id);
      if (step.lane >= layer.lanes.length)
        context.addIssue({ code: 'custom', message: 'Unknown step lane' });
    }
    for (const arrow of layer.arrows ?? []) {
      if (!ids.has(arrow.from) || !ids.has(arrow.to))
        context.addIssue({ code: 'custom', message: 'Unknown arrow step' });
    }
  });

export const reviewLayerSchema = layerInputSchema.safeExtend({
  steps: z.array(reviewStepSchema).min(1).max(500),
  fingerprint: fingerprintSchema,
});

const diagramArrowSchema = z.strictObject({
  from: idSchema,
  to: idSchema,
  label: z.string().trim().min(1).max(200).optional(),
  dashed: z.boolean().optional(),
});
const diagramBoxSchema = z.strictObject({
  id: idSchema,
  lane: z.number().int().min(0).max(99),
  label: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(1).max(2_000).optional(),
  kind: z.enum(['actor', 'component', 'storage', 'transport', 'credential']),
  change: z.enum(['new', 'changed', 'removed']).optional(),
  problem: z.string().trim().min(1).max(2_000).optional(),
  layerId: idSchema.optional(),
});
export const diagramSchema = z
  .strictObject({
    lanes: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
    boxes: z.array(diagramBoxSchema).max(500),
    arrows: z.array(diagramArrowSchema).max(1_000),
  })
  .superRefine((diagram, context) => {
    const ids = new Set(diagram.boxes.map((box) => box.id));
    for (const box of diagram.boxes)
      if (box.lane >= diagram.lanes.length)
        context.addIssue({ code: 'custom', message: 'Unknown diagram lane' });
    for (const arrow of diagram.arrows)
      if (!ids.has(arrow.from) || !ids.has(arrow.to))
        context.addIssue({ code: 'custom', message: 'Unknown diagram box' });
  });
export const reviewDiagramSchema = z.strictObject({
  after: diagramSchema,
  before: diagramSchema.optional(),
});

export const reviewParamsSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
});
const summaryHtmlSchema = z
  .string()
  .min(1)
  .max(10 * 1024 * 1024)
  .refine(
    (value) =>
      !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        value,
      ),
    'Expected valid Unicode text',
  )
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
export const publishReviewSchema = z
  .strictObject({
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
    summaryHtml: summaryHtmlSchema,
    diagram: reviewDiagramSchema.optional(),
    layers: z.array(layerInputSchema).min(1).max(100),
  })
  .superRefine((review, context) => {
    const ids = new Set<string>();
    for (const layer of review.layers) {
      if (ids.has(layer.id))
        context.addIssue({ code: 'custom', message: 'Duplicate layer ID' });
      ids.add(layer.id);
    }
  });

export const notExplainedSchema = z.strictObject({
  path: gitPathSchema,
  ranges: z.array(
    z.strictObject({ startLine: lineSchema, endLine: lineSchema }),
  ),
  deleted: z.boolean().optional(),
  binary: z.boolean().optional(),
});

export const reviewResponseSchema = z.strictObject({
  environmentId: z.uuid(),
  worktreeId: worktreeIdSchema,
  revision: z.number().int().positive(),
  publishedAt: z.string().datetime(),
  active: z.boolean(),
  /** Git-derived coverage is best effort and never blocks the stored publication. */
  diagnostics: z.enum(['current', 'unavailable']),
  summary: z.strictObject({
    url: z.string().min(1),
    byteLength: z.number().int().positive(),
  }),
  diagram: reviewDiagramSchema.optional(),
  layers: z.array(reviewLayerSchema).max(100),
  notExplained: z.array(notExplainedSchema).max(2_000),
});

export const reviewReadResponseSchema = z.strictObject({
  review: reviewResponseSchema.nullable(),
});

export type CodePointerInput = z.infer<typeof codePointerInputSchema>;
export type CodePointer = z.infer<typeof codePointerSchema>;
export type ReviewStep = z.infer<typeof reviewStepSchema>;
export type ReviewLayer = z.infer<typeof reviewLayerSchema>;
export type Diagram = z.infer<typeof diagramSchema>;
export type DiagramBox = z.infer<typeof diagramBoxSchema>;
export type ReviewDiagram = z.infer<typeof reviewDiagramSchema>;
export type PublishReview = z.infer<typeof publishReviewSchema>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
export type ReviewReadResponse = z.infer<typeof reviewReadResponseSchema>;
