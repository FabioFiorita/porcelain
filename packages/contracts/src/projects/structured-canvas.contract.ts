import { z } from 'zod'

export const STRUCTURED_CANVAS_VERSION = 1 as const
export const STRUCTURED_CANVAS_MAX_TABS = 4
export const STRUCTURED_CANVAS_MAX_TAB_LABEL_LENGTH = 24
export const STRUCTURED_CANVAS_MAX_BLOCKS_PER_TAB = 16
export const STRUCTURED_CANVAS_MAX_ASSETS = 64

const bundlePathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (path) =>
      !path.startsWith('/') &&
      !path.includes('\\') &&
      !path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..'),
    { message: 'must be a confined bundle-relative path' },
  )

export const structuredCanvasBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('markdown'), content: z.string().min(1).max(250_000) }).strict(),
  z
    .object({
      type: z.literal('html'),
      content: z.string().min(1).max(250_000),
      height: z.number().int().min(160).max(1200).optional(),
    })
    .strict(),
])
export type StructuredCanvasBlock = z.infer<typeof structuredCanvasBlockSchema>

export const structuredCanvasTabSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(32)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    label: z.string().min(1).max(STRUCTURED_CANVAS_MAX_TAB_LABEL_LENGTH),
    blocks: z.array(structuredCanvasBlockSchema).min(1).max(STRUCTURED_CANVAS_MAX_BLOCKS_PER_TAB),
  })
  .strict()
export type StructuredCanvasTab = z.infer<typeof structuredCanvasTabSchema>

export const structuredCanvasAssetSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('image'),
      path: bundlePathSchema,
      alt: z.string().min(1).max(160),
      caption: z.string().max(500).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('video'),
      path: bundlePathSchema,
      label: z.string().min(1).max(160),
      caption: z.string().max(500).optional(),
      captionsPath: bundlePathSchema.optional(),
    })
    .strict(),
])
export type StructuredCanvasAsset = z.infer<typeof structuredCanvasAssetSchema>

export const structuredCanvasDocumentSchema = z
  .object({
    version: z.literal(STRUCTURED_CANVAS_VERSION),
    title: z.string().min(1).max(120),
    tabs: z.array(structuredCanvasTabSchema).min(1).max(STRUCTURED_CANVAS_MAX_TABS),
    assets: z.array(structuredCanvasAssetSchema).max(STRUCTURED_CANVAS_MAX_ASSETS).default([]),
  })
  .strict()
  .superRefine((document, context) => {
    const ids = new Set<string>()
    document.tabs.forEach((tab, index) => {
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
export type StructuredCanvasDocument = z.infer<typeof structuredCanvasDocumentSchema>

export function structuredCanvasValidationMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 4)
    .map(
      (issue) => `${issue.path.length === 0 ? 'document' : issue.path.join('.')}: ${issue.message}`,
    )
    .join('; ')
}
