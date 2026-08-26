import { Alert, Linking } from 'react-native'
import { WebView } from 'react-native-webview'

import { openPreviewExternalLink } from '@/features/files/preview-open-link'
import { useBottomChrome } from '@/features/shell/window-chrome'

/**
 * The one place this client renders someone else's document.
 *
 * Both readable non-source views go through it — markdown turned into HTML, and an HTML file
 * shown as itself — so there is a single set of rules about what a previewed file may do,
 * rather than one set per surface.
 *
 * The rules are the renderer's `sandbox=""` iframe, expressed the way a WebView expresses them:
 * scripting off, no network (the document's own CSP), and every navigation refused. A repo file
 * is not trusted content; opening it to read must not run it.
 *
 * It also owns the bottom-chrome clearance for every document, as a **scroll inset** on the
 * WebView rather than padding inside the HTML. The rejected alternative had each caller pass
 * the tab bar's height down to the document builders, which then interpolated it into the
 * stylesheet (`padding: 16px 18px ${48 + bottomInset}px`) and injected a spacer `<div>` before
 * `</body>`. That put host geometry inside content — it edited an arbitrary repo file to lay
 * out the app around it, it padded unconditionally so a short document grew a dead page under
 * its last line whether or not anything ever scrolled, and it made every caller of a document
 * builder responsible for a number it had no business knowing. A scroll inset is the same idea
 * expressed where it belongs: the document is untouched, and the space exists only while there
 * is something to scroll past it.
 */
export function PreviewView({
  document,
  mediaPlayback = false,
  onSelection,
  testID,
}: {
  /** A complete HTML document — see `preview-document`, which is what builds them. */
  document: string
  /** Opt into native video controls only for the dedicated evidence video viewer. */
  mediaPlayback?: boolean
  onSelection?: (selection: { startLine: number; endLine: number; text: string }) => void
  testID: string
}): React.JSX.Element {
  const bottomInset = useBottomChrome()
  return (
    <WebView
      // No baseUrl: the document resolves nothing relative, so a stray `src` cannot reach the
      // file system or the network even before the CSP is consulted.
      allowsFullscreenVideo={mediaPlayback}
      allowsInlineMediaPlayback={mediaPlayback}
      contentInset={{ bottom: bottomInset }}
      // Ours is the only inset; iOS adding its own on top is the double reservation this
      // whole seam exists to stop.
      contentInsetAdjustmentBehavior="never"
      // Arbitrary HTML remains inert. Generated Markdown may run only our selection bridge.
      injectedJavaScript={onSelection ? PREVIEW_SELECTION_BRIDGE : undefined}
      javaScriptEnabled={onSelection !== undefined}
      onMessage={(event) => {
        if (!onSelection) return
        try {
          const value = JSON.parse(event.nativeEvent.data) as {
            source?: unknown
            startLine?: unknown
            endLine?: unknown
            text?: unknown
          }
          if (
            value.source === 'porcelain-preview-selection' &&
            typeof value.startLine === 'number' &&
            typeof value.endLine === 'number' &&
            typeof value.text === 'string'
          ) {
            onSelection({
              startLine: value.startLine,
              endLine: value.endLine,
              text: value.text.slice(0, 2000),
            })
          }
        } catch {
          // Ignore messages that do not belong to the selection bridge.
        }
      }}
      onShouldStartLoadWithRequest={(request) => {
        // The initial load of our own document is the only navigation that ever happens here.
        if (request.url === 'about:blank' || request.url.startsWith('data:')) return true
        // A tapped link leaves for the system browser instead of navigating the preview — and
        // only if it is a web link. Anything else (file:, javascript:, a custom scheme) is a
        // way out of the sandbox, not a link.
        if (/^https?:\/\//i.test(request.url)) {
          openPreviewExternalLink(
            request.url,
            (href) => Linking.openURL(href),
            (error) => {
              Alert.alert(
                'Could not open link',
                error instanceof Error ? error.message : String(error),
              )
            },
          )
        }
        return false
      }}
      originWhitelist={['about:blank']}
      setSupportMultipleWindows={false}
      source={{ html: document }}
      style={STYLE}
      testID={testID}
    />
  )
}

// nativewind-allow-style: WebView is a native host that does not take a className.
const STYLE = { backgroundColor: 'transparent', flex: 1 }

export const PREVIEW_SELECTION_BRIDGE = `(function(){
function line(node,edge){var el=node&&node.nodeType===1?node:node&&node.parentElement;var hit=el&&el.closest('[data-source-start-line]');if(!hit)return null;return Number(hit.getAttribute(edge==='start'?'data-source-start-line':'data-source-end-line'))}
function send(){var s=getSelection();if(!s||s.isCollapsed||!s.rangeCount)return;var r=s.getRangeAt(0),a=line(r.startContainer,'start'),b=line(r.endContainer,'end'),text=String(s).trim();if(!text||!a||!b)return;window.ReactNativeWebView.postMessage(JSON.stringify({source:'porcelain-preview-selection',startLine:Math.min(a,b),endLine:Math.max(a,b),text:text.slice(0,2000)}))}
document.addEventListener('selectionchange',function(){setTimeout(send,0)},true);document.addEventListener('touchend',send,true)
})();true;`
