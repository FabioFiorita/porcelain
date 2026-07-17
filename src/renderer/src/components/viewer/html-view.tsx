const HTML_EXTENSIONS = ['html', 'htm']

export function isHtmlPath(path: string): boolean {
  const ext = path.split('.').at(-1)?.toLowerCase() ?? ''
  return HTML_EXTENSIONS.includes(ext)
}

/**
 * Sandboxed HTML preview — same rules as feature artifacts / loop evidence:
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
      title={title}
      srcDoc={html}
      sandbox=""
      className="min-h-0 h-full w-full flex-1 border-0 bg-background"
    />
  )
}
