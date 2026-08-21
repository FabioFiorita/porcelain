import { Alert, Linking } from 'react-native'
import { WebView } from 'react-native-webview'

import { openPreviewExternalLink } from '@/features/files'
import { useBottomChrome } from '@/features/shell/window-chrome'

import { CANVAS_LINK_BRIDGE, canvasLinkHref, canvasNavigationAllowed } from './canvas-document'

/**
 * An agent-authored HTML Canvas, rendered under the closest posture a WebView can hold to
 * web's `sandbox="allow-scripts"` iframe.
 *
 * Scripting is ON here, unlike `PreviewView`: a Canvas is an explanation the agent wrote and
 * web runs its scripts, so an inert copy would be a different product. Everything else is
 * spent buying back what the sandbox attribute would have given:
 *
 * - `source={{ uri }}` on the daemon's own `GET /canvas/<token>` route, so the response CSP
 *   the daemon chose per Canvas arrives with the bytes — `connect-src 'none'` for every one,
 *   and for a tracked Canvas a `script-src` pinned to the hash of the daemon's own bridge, so
 *   no author script runs at all.
 * - `onShouldStartLoadWithRequest` admits only that one URL, standing in for the absent
 *   `allow-top-navigation`; `setSupportMultipleWindows`/`javaScriptCanOpenWindowsAutomatically`
 *   off stand in for the absent `allow-popups`.
 * - `incognito` with cookies and cache off gives the document a data store that outlives
 *   nothing and is shared with nothing.
 *
 * WHAT IS STILL WEAKER THAN THE IFRAME. A WebView loads a top-level document, so this one
 * carries the daemon's real origin rather than the opaque one `sandbox` without
 * `allow-same-origin` produces. Two things make that a much smaller hole than it sounds:
 * the daemon's `connect-src 'none'` forbids the document every fetch, XHR and WebSocket, so
 * it cannot call `/trpc` even though it is same-origin with it; and mobile's pairing token
 * lives in `expo-secure-store`, never in any web origin's storage, so there is nothing
 * same-origin to read. It is still a difference, and it is the reason the `originWhitelist`
 * below is `*` rather than the daemon: react-native-webview hands a URL that FAILS the
 * whitelist straight to `Linking.openURL` before this component's gate ever runs, so a
 * narrow whitelist would turn a blocked navigation into a forced app launch. Everything
 * reaches the gate, and the gate refuses everything.
 */
export function CanvasWebView({
  documentUrl,
  testID,
}: {
  documentUrl: string
  testID: string
}): React.JSX.Element {
  const bottomInset = useBottomChrome()
  return (
    <WebView
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      allowsLinkPreview={false}
      cacheEnabled={false}
      contentInset={{ bottom: bottomInset }}
      // Ours is the only inset; iOS adding its own on top double-reserves the tab bar.
      contentInsetAdjustmentBehavior="never"
      incognito
      injectedJavaScript={CANVAS_LINK_BRIDGE}
      javaScriptCanOpenWindowsAutomatically={false}
      javaScriptEnabled
      onMessage={(event) => {
        const href = canvasLinkHref(event.nativeEvent.data)
        if (href === null) return
        openPreviewExternalLink(
          href,
          (url) => Linking.openURL(url),
          (error) => {
            Alert.alert(
              'Could not open link',
              error instanceof Error ? error.message : String(error),
            )
          },
        )
      }}
      onShouldStartLoadWithRequest={(request) => canvasNavigationAllowed(request.url, documentUrl)}
      // See the module comment: a narrow whitelist auto-opens what it rejects.
      originWhitelist={ANY_ORIGIN}
      setSupportMultipleWindows={false}
      sharedCookiesEnabled={false}
      source={{ uri: documentUrl }}
      style={STYLE}
      testID={testID}
      thirdPartyCookiesEnabled={false}
    />
  )
}

const ANY_ORIGIN = ['*']

// nativewind-allow-style: WebView is a native host that does not take a className.
const STYLE = { backgroundColor: 'transparent', flex: 1 }
