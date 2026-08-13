import type { ReviewDoc } from '@porcelain/contracts/review'
import { markdownToHtml, PreviewView, previewDocument, readerDocument } from '@/features/files'
import { useResolvedColorScheme } from '@/features/settings/theme-provider'

/**
 * One agent-authored document, rendered the way its medium wants to be read.
 *
 * Shared by Intent and Evidence because they are literally the same channel — the daemon
 * reads both with `readIntentDocs`, under the same media, the same caps, and the same
 * promise that the content is untrusted. A single body means the two can never drift into
 * different rules for the same file.
 *
 * Markdown and HTML both land in the one sanctioned WebView host; only what wraps them
 * differs. Those two are the whole media story — there is no third kind of pane.
 */
export function IntentDocBody({
  doc,
  testIDPrefix,
}: {
  doc: ReviewDoc
  testIDPrefix: string
}): React.JSX.Element {
  const scheme = useResolvedColorScheme()

  if (doc.medium === 'markdown') {
    return (
      <PreviewView
        document={readerDocument(markdownToHtml(doc.body), scheme)}
        testID={`${testIDPrefix}-markdown`}
      />
    )
  }
  return <PreviewView document={previewDocument(doc.body)} testID={`${testIDPrefix}-html`} />
}
