import { z } from 'zod'
import { profileLayerSchema } from '../worktree-profile'
import {
  STRUCTURED_CANVAS_VERSION,
  type DecisionCanvasDocument,
  decisionCanvasDocumentSchema,
  type ReviewCanvasDocument,
  reviewCanvasDocumentSchema,
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

export const reviewCanvasTemplateDataSchema = z
  .object({
    title: z.string().min(1).max(120),
    why: z.string().min(1).max(50_000),
    how: z.string().min(1).max(50_000),
    layers: z.array(profileLayerSchema).default([]),
    files: z.array(reviewFileSchema).default([]),
  })
  .strict()
export type ReviewCanvasTemplateData = z.infer<typeof reviewCanvasTemplateDataSchema>

export function reviewCanvasDocument(data: ReviewCanvasTemplateData): ReviewCanvasDocument {
  return reviewCanvasDocumentSchema.parse({
    version: STRUCTURED_CANVAS_VERSION,
    template: 'review',
    title: data.title,
    why: data.why,
    how: data.how,
  })
}
