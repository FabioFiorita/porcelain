import { TestIds } from '@shared/test-ids'

const HTML_EXTENSIONS = ['html', 'htm']
const VIEWPORT_META =
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'

export function isHtmlPath(path: string): boolean {
  const ext = path.split('.').at(-1)?.toLowerCase() ?? ''
  return HTML_EXTENSIONS.includes(ext)
}

function responsiveHtml(html: string): string {
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
 * The Files "Preview" surface for an .html file: the document as a browser would
 * open it — its own stylesheets AND its own scripts running.
 *
 * `src`, never `srcdoc`, is the whole point. A `srcdoc` document inherits the app
 * shell's CSP (`script-src 'self'`), so an author's inline `<script>` is refused
 * there regardless of the sandbox attribute; a real HTTP response from the daemon
 * carries its own policy (file-preview-http.ts: scripts and styles inline, no
 * network at all). `sandbox="allow-scripts"` WITHOUT `allow-same-origin` keeps the
 * document on an opaque origin, so it can never read the app's storage or token.
 *
 * `bg-white` rather than `bg-background`: a document with no background of its own
 * must not show the dark app through it — a browser paints white, so this does too.
 */
export function HtmlDocumentFrame({
  src,
  title,
}: {
  src: string
  title: string
}): React.JSX.Element {
  return (
    <iframe
      data-testid={TestIds.htmlPreviewIframe}
      title={title}
      src={src}
      sandbox="allow-scripts"
      className="min-h-0 h-full w-full flex-1 border-0 bg-white"
    />
  )
}

/**
 * Sandboxed HTML preview — same rules as loop evidence / Review diagrams:
 * `sandbox=""` (no scripts, no same-origin, no popups) + `srcdoc`. Remote assets
 * stay blocked by the parent CSP (`img-src 'self' data:`); local relative images
 * should already be inlined as data URIs by the daemon (`previewHtml`).
 */
export function HtmlView({
  html,
  title = 'HTML preview',
}: {
  html: string
  title?: string
}): React.JSX.Element {
  return (
    <iframe
      data-testid={TestIds.evidenceIframe}
      title={title}
      srcDoc={responsiveHtml(html)}
      sandbox=""
      scrolling="yes"
      className="min-h-0 h-full w-full flex-1 overflow-y-auto overscroll-contain border-0 bg-background"
      style={{ WebkitOverflowScrolling: 'touch' }}
    />
  )
}
