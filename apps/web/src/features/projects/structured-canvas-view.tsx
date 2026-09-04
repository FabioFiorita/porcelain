import {
  structuredCanvasDocumentSchema,
  structuredCanvasValidationMessage,
} from '@porcelain/contracts/projects'
import { TestIds } from '@shared/test-ids'
import type { ReviewTarget } from '@renderer/stores/tabs'
import { DecisionCanvasView } from './decision-canvas-view'
import { ReviewCanvasView } from './review-canvas-view'

export function StructuredCanvasView({
  content,
  repoPath,
  assetBaseUrl = null,
  canvasId,
  reviewTarget,
}: {
  content: string
  repoPath?: string
  assetBaseUrl?: string | null
  canvasId?: string
  reviewTarget?: ReviewTarget
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
  if (parsed.data.template === 'review') {
    return (
      <div data-testid={TestIds.structuredCanvas} className="h-full min-h-0">
        <ReviewCanvasView
          document={parsed.data}
          repoPath={repoPath}
          assetBaseUrl={assetBaseUrl}
          canvasId={canvasId}
          reviewTarget={reviewTarget}
        />
      </div>
    )
  }
  return (
    <div data-testid={TestIds.structuredCanvas} className="h-full min-h-0">
      <DecisionCanvasView document={parsed.data} repoPath={repoPath} />
    </div>
  )
}
