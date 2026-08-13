import type { ReviewDoc } from '@porcelain/contracts/review'
import { PaneErrorBoundary } from '@renderer/components/shell/error-boundary'
import { HtmlView } from '@renderer/components/viewer/html-view'
import { MarkdownView } from '@renderer/components/viewer/markdown-view'
import { TestIds } from '@shared/test-ids'

/**
 * One document of a review document set — an Intent doc from `.porcelain/intent/`
 * or a Results doc from `evidence/results/`. Same primitive, same two media, so
 * one renderer serves both.
 *
 * Each medium keeps the rendering rule the app already earned: markdown through
 * react-markdown with default escaping (no rehype-raw, so a `<script>` in prose
 * is text), HTML only through the fully sandboxed `srcdoc` iframe with its
 * siblings already inlined daemon-side. Those two media are the whole story on
 * every client. There is no script medium — a review can arrive from a clone, and
 * `allow-scripts` would make that someone else's JavaScript in this renderer.
 */
export function ReviewDocBody({ doc }: { doc: ReviewDoc }): React.JSX.Element {
  if (doc.medium === 'html') {
    return (
      <div className="h-full min-h-0 p-3" data-testid={TestIds.reviewDocBody}>
        <PaneErrorBoundary label={doc.label}>
          <div className="h-full min-h-0 overflow-hidden rounded-md border">
            <HtmlView html={doc.body} title={doc.label} />
          </div>
        </PaneErrorBoundary>
      </div>
    )
  }
  return (
    <div className="h-full min-h-0" data-testid={TestIds.reviewDocBody}>
      <PaneErrorBoundary label={doc.label}>
        <MarkdownView content={doc.body} />
      </PaneErrorBoundary>
    </div>
  )
}
