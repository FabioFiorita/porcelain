import type { ReviewCanvas } from '@backend/review-set'
import { ExcalidrawHost } from '@renderer/components/viewer/excalidraw-host'
import { HtmlView } from '@renderer/components/viewer/html-view'
import type { ExcalidrawScene } from '@shared/excalidraw-scene'

/**
 * Freeform Intent canvas body — HTML (sandboxed) or Excalidraw (read-only host).
 * Used when the review set carries an explicit `canvas` field (Intent medium).
 */
export function CanvasBody({ canvas }: { canvas: ReviewCanvas }): React.JSX.Element {
  if (canvas.medium === 'html') {
    return (
      <div className="h-full min-h-0 p-3">
        <div className="h-full min-h-0 overflow-hidden rounded-md border">
          <HtmlView html={canvas.html} title="Intent canvas" />
        </div>
      </div>
    )
  }
  return (
    <div className="h-full min-h-0 p-3">
      <ExcalidrawHost scene={canvas.scene as ExcalidrawScene} />
    </div>
  )
}
