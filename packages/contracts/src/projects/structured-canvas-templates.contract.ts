import { z } from 'zod'
import { profileLayerSchema } from '../worktree-profile'
import {
  type StructuredCanvasDocument,
  structuredCanvasAssetSchema,
  structuredCanvasBlockSchema,
  structuredCanvasDocumentSchema,
  structuredCanvasTabSchema,
} from './structured-canvas.contract'

const reviewFileSchema = z
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
    why: z.array(structuredCanvasBlockSchema).min(1).max(16),
    how: z.array(structuredCanvasBlockSchema).min(1).max(16),
    assets: z.array(structuredCanvasAssetSchema).max(64).default([]),
    layers: z.array(profileLayerSchema).default([]),
    files: z.array(reviewFileSchema).default([]),
  })
  .strict()
export type ReviewCanvasTemplateData = z.infer<typeof reviewCanvasTemplateDataSchema>

export const planCanvasTemplateDataSchema = z
  .object({
    title: z.string().min(1).max(120),
    tabs: z.array(structuredCanvasTabSchema).min(1).max(4),
    assets: z.array(structuredCanvasAssetSchema).max(64).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set<string>()
    value.tabs.forEach((tab, index) => {
      if (ids.has(tab.id)) {
        context.addIssue({
          code: 'custom',
          message: `duplicate tab id: ${tab.id}`,
          path: ['tabs', index, 'id'],
        })
      }
      ids.add(tab.id)
    })
  })
export type PlanCanvasTemplateData = z.infer<typeof planCanvasTemplateDataSchema>

export function reviewCanvasDocument(data: ReviewCanvasTemplateData): StructuredCanvasDocument {
  return structuredCanvasDocumentSchema.parse({
    version: 1,
    title: data.title,
    tabs: [
      { id: 'why', label: 'Why', blocks: data.why },
      { id: 'how', label: 'How', blocks: data.how },
    ],
    assets: data.assets,
  })
}

export function planCanvasDocument(data: PlanCanvasTemplateData): StructuredCanvasDocument {
  return structuredCanvasDocumentSchema.parse({ version: 1, ...data })
}
