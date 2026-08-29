import { z } from 'zod'
import {
  STRUCTURED_CANVAS_VERSION,
  type StructuredCanvasDocument,
  structuredCanvasDocumentSchema,
} from './structured-canvas.contract'

export const decisionCanvasTemplateDataSchema = z.preprocess(
  (value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? { version: STRUCTURED_CANVAS_VERSION, template: 'decision', ...value }
      : value,
  structuredCanvasDocumentSchema,
)
export type DecisionCanvasTemplateData = Omit<
  z.input<typeof structuredCanvasDocumentSchema>,
  'version' | 'template'
>

export function decisionCanvasDocument(data: DecisionCanvasTemplateData): StructuredCanvasDocument {
  return structuredCanvasDocumentSchema.parse({
    version: STRUCTURED_CANVAS_VERSION,
    template: 'decision',
    ...data,
  })
}
