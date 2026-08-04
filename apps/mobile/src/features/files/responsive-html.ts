const VIEWPORT_META =
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'

/**
 * Ensure a full HTML document has a mobile viewport so a preview does not paint as a
 * desktop-width page on a phone. Mirrors the web client's `responsiveHtml`.
 */
export function ensureResponsiveHtml(html: string): string {
  if (/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(html)) return html
  const head = /<head\b[^>]*>/i
  if (head.test(html)) return html.replace(head, (tag) => tag + VIEWPORT_META)
  const htmlTag = /<html\b[^>]*>/i
  if (htmlTag.test(html)) {
    return html.replace(htmlTag, (tag) => `${tag}<head>${VIEWPORT_META}</head>`)
  }
  return `<!doctype html><html><head>${VIEWPORT_META}</head><body>${html}</body></html>`
}
