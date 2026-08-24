import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FilePreviewAccessScope } from '../features/files/file-preview-tokens'

const FILE_PREVIEW_ROUTE_PREFIX = '/file-preview/'

/**
 * The preview document's own policy — the whole reason this route exists.
 *
 * A `srcdoc` iframe INHERITS the app shell's CSP (apps/web/index.html:
 * `script-src 'self' 'wasm-unsafe-eval'`), so an author's inline `<script>` is
 * refused there no matter what the sandbox attribute says (verified in a browser
 * against the dev daemon). A real HTTP response carries its own policy, so this
 * is the only way a previewed HTML file can behave the way a browser tab does:
 * Tailwind Play, mermaid-from-a-CDN, Google Fonts, a remote screenshot.
 *
 * Local siblings are still inlined as data URIs (inlineLocalAssets) so a file
 * that only references `./shot.png` keeps working offline. `https:` on script /
 * style / img / font / media is what lets a review document load the rest.
 *
 * What it still refuses: fetch / XHR / beacon (`connect-src 'none'`), forms,
 * framing, and a `http:` (non-TLS) subresource. Canvas stays on the tighter
 * canvas-http.ts policy — that document is private daemon state, not a repo
 * file the user could open in a tab.
 *
 * `blob:` on img/media because mermaid (and similar) draws into object URLs.
 */
const FILE_PREVIEW_DOCUMENT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https:",
  "style-src 'unsafe-inline' https:",
  'img-src data: blob: https:',
  'media-src data: blob: https:',
  'font-src data: https:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ')

export type FilePreviewHttpDeps = Readonly<{
  resolveAccessToken: (token: string) => FilePreviewAccessScope | null
  readPreviewDocument: (
    scope: FilePreviewAccessScope,
  ) => Promise<{ ok: true; value: string | null } | { ok: false; error: unknown }>
}>

/** `/file-preview/<token>` only — one segment, no sibling asset paths (they are inlined). */
export function filePreviewTokenFromUrl(url: string): string | null {
  const pathOnly = url.split('?')[0]?.split('#')[0] ?? ''
  if (!pathOnly.startsWith(FILE_PREVIEW_ROUTE_PREFIX)) return null
  const rest = pathOnly.slice(FILE_PREVIEW_ROUTE_PREFIX.length)
  if (rest === '' || rest.includes('/')) return null
  return rest
}

function writePlainText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(body)
}

const VIEWPORT_META =
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'

/** Same responsive treatment the srcdoc reader applies, so the two surfaces match. */
export function responsivePreviewDocument(html: string): string {
  if (/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(html)) return html
  const head = /<head\b[^>]*>/i
  if (head.test(html)) return html.replace(head, (tag) => tag + VIEWPORT_META)
  const htmlTag = /<html\b[^>]*>/i
  if (htmlTag.test(html)) {
    return html.replace(htmlTag, (tag) => `${tag}<head>${VIEWPORT_META}</head>`)
  }
  return `<!doctype html><html><head>${VIEWPORT_META}</head><body>${html}</body></html>`
}

/**
 * Serves ONE previewed HTML file on the daemon's own origin, for the Files
 * viewer's `sandbox="allow-scripts"` iframe (no `allow-same-origin`, so the
 * document has an opaque origin and cannot touch the app's storage or token).
 *
 * The token IS the credential — an iframe navigation sends no Authorization
 * header — so this route does not run through the Bearer gate; the grant is
 * minted only for an already-authenticated tRPC caller (mintFilePreviewToken)
 * and expires in minutes. GET/HEAD only.
 */
export async function handleFilePreviewRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FilePreviewHttpDeps,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    res.end()
    return
  }
  const token = filePreviewTokenFromUrl(req.url ?? '')
  if (token === null) {
    writePlainText(res, 404, 'not found')
    return
  }
  const scope = deps.resolveAccessToken(token)
  if (scope === null) {
    writePlainText(res, 401, 'expired or unknown file preview token')
    return
  }
  const result = await deps.readPreviewDocument(scope)
  if (!result.ok || result.value === null) {
    writePlainText(res, 404, 'not found')
    return
  }

  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': FILE_PREVIEW_DOCUMENT_CSP,
    'cache-control': 'no-store',
  }
  if (req.method === 'HEAD') {
    res.writeHead(200, headers)
    res.end()
    return
  }
  res.writeHead(200, headers)
  res.end(responsivePreviewDocument(result.value))
}
