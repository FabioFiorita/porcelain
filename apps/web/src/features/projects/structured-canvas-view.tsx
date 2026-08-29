import {
  structuredCanvasDocumentSchema,
  structuredCanvasValidationMessage,
} from '@porcelain/contracts/projects'
import { TestIds } from '@shared/test-ids'
import { DecisionCanvasView } from './decision-canvas-view'

export function StructuredCanvasView({
  content,
  repoPath,
}: {
  content: string
  repoPath?: string
}): React.JSX.Element {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch (error) {
    return (
      <div data-testid={TestIds.structuredCanvasInvalid} className="p-6 text-sm text-destructive">
        Invalid structured Canvas: {error instanceof Error ? error.message : 'invalid JSON'}
      </div>
    )
  }
  const parsed = structuredCanvasDocumentSchema.safeParse(value)
  if (!parsed.success) {
    return (
      <div data-testid={TestIds.structuredCanvasInvalid} className="p-6 text-sm text-destructive">
        Invalid structured Canvas: {structuredCanvasValidationMessage(parsed.error)}
      </div>
    )
  }
  return (
    <div data-testid={TestIds.structuredCanvas} className="h-full min-h-0">
      <DecisionCanvasView document={parsed.data} repoPath={repoPath} />
    </div>
  )
}
