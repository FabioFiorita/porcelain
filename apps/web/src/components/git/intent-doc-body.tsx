import type { IntentDoc } from '@backend/review/intent-docs'
import { PaneErrorBoundary } from '@renderer/components/shell/error-boundary'
import { ExcalidrawHost } from '@renderer/components/viewer/excalidraw-host'
import { HtmlView } from '@renderer/components/viewer/html-view'
import { MarkdownView } from '@renderer/components/viewer/markdown-view'
import { TestIds } from '@shared/test-ids'

/**
 * One Intent document from `.porcelain/intent/`.
 *
 * Each medium keeps the rendering rule the app already earned: markdown through
 * react-markdown with default escaping (no rehype-raw, so a `<script>` in prose
 * is text), HTML only through the fully sandboxed `srcdoc` iframe with its
 * siblings already inlined daemon-side, and Excalidraw as inert JSON. There is
 * no script medium — a review can arrive from a clone, and `allow-scripts` would
 * make that someone else's JavaScript in this renderer.
 */
export function IntentDocBody({ doc }: { doc: IntentDoc }): React.JSX.Element {
  if (doc.medium === 'html') {
    return (
      <div className="h-full min-h-0 p-3" data-testid={TestIds.intentDocBody}>
        <div className="h-full min-h-0 overflow-hidden rounded-md border">
          <HtmlView html={doc.body} title={doc.label} />
        </div>
      </div>
    )
  }
  if (doc.medium === 'excalidraw') {
    // Already parsed daemon-side: the scene parser is Buffer-based and this is a
    // pure-UI client. A malformed scene never reaches here — it is dropped on read.
    return (
      <div className="h-full min-h-0 p-3" data-testid={TestIds.intentDocBody}>
        <PaneErrorBoundary label={doc.label}>
          <ExcalidrawHost scene={doc.scene} />
        </PaneErrorBoundary>
      </div>
    )
  }
  return (
    <div className="h-full min-h-0" data-testid={TestIds.intentDocBody}>
      <MarkdownView content={doc.body} />
    </div>
  )
}
