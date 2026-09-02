import {
  structuredCanvasDocumentSchema,
  structuredCanvasValidationMessage,
  type StructuredCanvasDocument,
} from '@porcelain/contracts/projects'

export function parseStructuredCanvas(
  content: unknown,
): { document: StructuredCanvasDocument; error: null } | { document: null; error: string } {
  let value: unknown
  try {
    value = typeof content === 'string' ? JSON.parse(content) : content
  } catch {
    return { document: null, error: 'Canvas content is not valid JSON.' }
  }
  const parsed = structuredCanvasDocumentSchema.safeParse(value)
  return parsed.success
    ? { document: parsed.data, error: null }
    : { document: null, error: structuredCanvasValidationMessage(parsed.error) }
}
