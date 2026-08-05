import { EmptyNote } from '@/components/panel-chrome'
import { markdownToHtml, previewDocument, readerDocument } from '@/features/files/preview-document'
import { PreviewView } from '@/features/files/preview-view'
import { useResolvedColorScheme } from '@/features/settings/theme-provider'
import type { IntentDoc } from '@/lib/daemon/procedures/review'

/**
 * One agent-authored document, rendered the way its medium wants to be read.
 *
 * Shared by Intent and Evidence because they are literally the same channel — the daemon
 * reads both with `readIntentDocs`, under the same media, the same caps, and the same
 * promise that the content is untrusted. A single body means the two can never drift into
 * different rules for the same file.
 *
 * Markdown and HTML both land in the one sanctioned WebView host; only what wraps them
 * differs. An Excalidraw scene has no mobile renderer at all and says so.
 */
export function IntentDocBody({
  doc,
  testIDPrefix,
}: {
  doc: IntentDoc
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
  if (doc.medium === 'html') {
    return <PreviewView document={previewDocument(doc.body)} testID={`${testIDPrefix}-html`} />
  }
  return <SceneNote testID={`${testIDPrefix}-scene`} />
}

/**
 * An Excalidraw scene is inert JSON that only the desktop's canvas host can draw. Saying so
 * is the honest answer: a reader told the pane exists and where to open it has lost nothing,
 * while a silently dropped tab reads as a broken Review.
 */
export function SceneNote({ testID }: { testID: string }): React.JSX.Element {
  return (
    <EmptyNote
      body="This pane is an Excalidraw board. Open the Review on the desktop to draw it — this client has no canvas host."
      testID={testID}
      title="Open on desktop to view this canvas"
    />
  )
}
