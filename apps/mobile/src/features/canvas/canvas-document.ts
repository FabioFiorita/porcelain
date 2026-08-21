/**
 * The rules an HTML Canvas is rendered under, kept out of the view so they can be tested
 * without a native WebView.
 *
 * The web client loads a Canvas in an iframe with `sandbox="allow-scripts"` and nothing else
 * (`canvas-view.tsx`): scripts run, but the document gets an opaque origin, cannot navigate
 * the top frame, and cannot open a window. A WebView has no per-document sandbox flag, so the
 * same guarantees have to be assembled out of the pieces a WebView does have:
 *
 * - The document is loaded by URL from `GET /canvas/<token>`, never inlined, so the daemon's
 *   own response CSP travels with it — `connect-src 'none'` for every Canvas, and a
 *   hash-pinned `script-src` for a tracked one. Reconstructing that policy on the client
 *   would put a second owner on a security rule the daemon already decides.
 * - {@link canvasNavigationAllowed} stands in for the missing `allow-top-navigation`: only the
 *   minted document URL itself ever loads.
 * - {@link CANVAS_LINK_BRIDGE} plus {@link canvasLinkHref} are the only way out, the same role
 *   the `message` listener plays on web when `allow-popups` is withheld.
 *
 * What is still weaker than the iframe is recorded in the module comment of
 * `canvas-web-view.tsx`, next to the props that mitigate it.
 */

/** The `GET /canvas/<token>` URL for a minted access token. */
export function canvasDocumentUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/canvas/${encodeURIComponent(token)}`
}

/**
 * Forward the Canvas bootstrap's link message to the app.
 *
 * The daemon appends a click interceptor to every HTML Canvas that calls `preventDefault()`
 * and posts `{ source: 'porcelain-canvas', href }` to `parent` (canvas-operations.ts). In an
 * iframe `parent` is the app; in a top-level WebView `parent === window`, so the message
 * lands back in the same document and nothing reaches React Native unless something listens
 * for it here. Injected through the native bridge rather than as page script, which is why it
 * still runs on a tracked Canvas whose CSP admits no script but the daemon's own — the ban on
 * *author* script is untouched.
 *
 * The trailing `true` keeps iOS from warning about a non-serialisable evaluation result.
 */
export const CANVAS_LINK_BRIDGE = `(function () {
  window.addEventListener('message', function (event) {
    var data = event.data
    if (data === null || typeof data !== 'object') return
    if (data.source !== 'porcelain-canvas' || typeof data.href !== 'string') return
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ source: 'porcelain-canvas', href: data.href })
    )
  })
})();
true;`

/**
 * The link a Canvas asked to open, or null for anything else that reaches `onMessage`.
 *
 * Stricter than web's `window.open(href)`: only an absolute `http(s)` URL is a link. The
 * bootstrap forwards the raw `href` attribute, so a relative one would resolve against the
 * daemon's own origin — a URL the system browser cannot fetch anyway, since it carries no
 * pairing token — and every other scheme (`javascript:`, `file:`, a custom app scheme) is a
 * way out of the sandbox rather than a link.
 */
export function canvasLinkHref(message: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(message)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>
  if (record.source !== 'porcelain-canvas') return null
  const href = record.href
  if (typeof href !== 'string' || !/^https?:\/\//i.test(href)) return null
  return href
}

/**
 * Which navigations the Canvas WebView performs: its own document, and nothing else.
 *
 * `about:blank` is the empty frame the platform starts from, not content. Every other
 * request — a script assigning `location`, a form, a link the bootstrap did not catch — is
 * refused outright and opens nowhere, because that is what web's sandbox does with no
 * `allow-top-navigation` and no `allow-popups`.
 */
export function canvasNavigationAllowed(url: string, documentUrl: string): boolean {
  return url === documentUrl || url === 'about:blank'
}
