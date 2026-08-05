import { Linking } from 'react-native'
import { WebView } from 'react-native-webview'

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
 */
export function PreviewView({
  document,
  testID,
}: {
  /** A complete HTML document — see `preview-document`, which is what builds them. */
  document: string
  testID: string
}): React.JSX.Element {
  return (
    <WebView
      // No baseUrl: the document resolves nothing relative, so a stray `src` cannot reach the
      // file system or the network even before the CSP is consulted.
      allowsFullscreenVideo={false}
      allowsInlineMediaPlayback={false}
      // The document is inert; scripting buys it nothing and costs it every injection bug.
      javaScriptEnabled={false}
      onShouldStartLoadWithRequest={(request) => {
        // The initial load of our own document is the only navigation that ever happens here.
        if (request.url === 'about:blank' || request.url.startsWith('data:')) return true
        // A tapped link leaves for the system browser instead of navigating the preview — and
        // only if it is a web link. Anything else (file:, javascript:, a custom scheme) is a
        // way out of the sandbox, not a link.
        if (/^https?:\/\//i.test(request.url)) Linking.openURL(request.url).catch(() => undefined)
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
