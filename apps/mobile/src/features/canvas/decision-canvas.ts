import {
  structuredCanvasDocumentSchema,
  structuredCanvasValidationMessage,
  type DecisionCanvasDocument,
} from '@porcelain/contracts/projects'

export function parseDecisionCanvas(
  content: unknown,
): { document: DecisionCanvasDocument; error: null } | { document: null; error: string } {
  let value: unknown
  try {
    value = typeof content === 'string' ? JSON.parse(content) : content
  } catch {
    return { document: null, error: 'Canvas content is not valid JSON.' }
  }
  const parsed = structuredCanvasDocumentSchema.safeParse(value)
  if (!parsed.success) {
    return { document: null, error: structuredCanvasValidationMessage(parsed.error) }
  }
  return parsed.data.template === 'decision'
    ? { document: parsed.data, error: null }
    : { document: null, error: 'template: expected decision' }
}
