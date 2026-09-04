import { z } from 'zod'
import { profileLayerSchema } from '../worktree-profile'
import {
  type DecisionCanvasDocument,
  decisionCanvasDocumentSchema,
  type ReviewCanvasDocument,
  reviewCanvasDocumentSchema,
  reviewCanvasEvidenceSchema,
  reviewCanvasSectionSchema,
  STRUCTURED_CANVAS_VERSION,
} from './structured-canvas.contract'

export const decisionCanvasTemplateDataSchema = z.preprocess(
  (value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? { version: STRUCTURED_CANVAS_VERSION, template: 'decision', ...value }
      : value,
  decisionCanvasDocumentSchema,
)
export type DecisionCanvasTemplateData = Omit<
  z.input<typeof decisionCanvasDocumentSchema>,
  'version' | 'template'
>

export function decisionCanvasDocument(data: DecisionCanvasTemplateData): DecisionCanvasDocument {
  return decisionCanvasDocumentSchema.parse({
    version: STRUCTURED_CANVAS_VERSION,
    template: 'decision',
    ...data,
  })
}

export const reviewFileSchema = z
  .object({
    path: z.string().min(1).max(512),
    source: z.enum(['changed', 'context', 'shipped']).optional(),
    note: z.string().max(500).optional(),
    layer: z.string().max(120).optional(),
  })
  .strict()

/** Persisted beside the semantic Review document; required for full-document MCP writes. */
export const reviewCanvasMetadataSchema = z
  .object({
    layers: z.array(profileLayerSchema).default([]),
    files: z.array(reviewFileSchema).default([]),
  })
  .strict()
export type ReviewCanvasMetadata = z.infer<typeof reviewCanvasMetadataSchema>

export const reviewCanvasTemplateDataSchema = z
  .object({
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(4096).optional(),
    sections: z.array(reviewCanvasSectionSchema).min(1).max(30).optional(),
    /** Compatibility input for Review Canvases authored before ordered sections. */
    why: z.string().min(1).max(50_000).optional(),
    /** Compatibility input for Review Canvases authored before ordered sections. */
    how: z.string().min(1).max(50_000).optional(),
    evidence: reviewCanvasEvidenceSchema.optional(),
    layers: z.array(profileLayerSchema).default([]),
    files: z.array(reviewFileSchema).default([]),
  })
  .strict()
  .superRefine((data, context) => {
    const hasLegacyPair = data.why !== undefined && data.how !== undefined
    if (data.sections === undefined && !hasLegacyPair) {
      context.addIssue({
        code: 'custom',
        message: 'sections, or both why and how, are required',
        path: ['sections'],
      })
    }
    if ((data.why === undefined) !== (data.how === undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'why and how must be provided together',
        path: [data.why === undefined ? 'why' : 'how'],
      })
    }
  })
export type ReviewCanvasTemplateData = z.infer<typeof reviewCanvasTemplateDataSchema>
export type ReviewCanvasTemplateDataInput = z.input<typeof reviewCanvasTemplateDataSchema>

export function reviewCanvasDocument(data: ReviewCanvasTemplateDataInput): ReviewCanvasDocument {
  const parsed = reviewCanvasTemplateDataSchema.parse(data)
  return reviewCanvasDocumentSchema.parse({
    version: STRUCTURED_CANVAS_VERSION,
    template: 'review',
    title: parsed.title,
    ...(parsed.summary === undefined ? {} : { summary: parsed.summary }),
    ...(parsed.sections === undefined
      ? { why: parsed.why, how: parsed.how }
      : { sections: parsed.sections }),
    ...(parsed.evidence === undefined ? {} : { evidence: parsed.evidence }),
  })
}
