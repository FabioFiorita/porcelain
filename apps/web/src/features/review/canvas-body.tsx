import type { ReviewCanvas } from '@porcelain/contracts/review'
import { PaneErrorBoundary } from '@renderer/components/shell/error-boundary'
import { HtmlView } from '@renderer/components/viewer/html-view'

/**
 * Freeform Intent canvas body — agent-authored HTML in the sandboxed frame.
 * Used when the review set carries an explicit `canvas` field (Intent medium).
 */
export function CanvasBody({ canvas }: { canvas: ReviewCanvas }): React.JSX.Element {
  return (
    <div className="h-full min-h-0 p-3">
      <PaneErrorBoundary label="This board">
        <div className="h-full min-h-0 overflow-hidden rounded-md border">
          <HtmlView html={canvas.html} title="Intent canvas" />
        </div>
      </PaneErrorBoundary>
    </div>
  )
}
