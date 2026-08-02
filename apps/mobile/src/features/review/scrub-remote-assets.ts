const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

function replaceAssetValue(value: string, blocked: { count: number }): string {
  if (value.trim().toLowerCase().startsWith('data:')) return value
  blocked.count += 1
  return PIXEL
}

/**
 * Evidence is rendered from a string-only WebView source. The daemon inlines local assets, but
 * absolute and relative leftovers must not get a chance to beacon from a phone. Keep the HTML
 * structure and replace every non-data image/font/background asset with a transparent pixel.
 */
export function scrubRemoteAssets(html: string): { html: string; blocked: number } {
  const blocked = { count: 0 }
  let scrubbed = html.replace(
    /\b(src|srcset)\s*=\s*(["'])([\s\S]*?)\2/gi,
    (_match: string, attribute: string, quote: string, value: string): string =>
      `${attribute}=${quote}${replaceAssetValue(value, blocked)}${quote}`,
  )
  scrubbed = scrubbed.replace(
    /url\(\s*(["']?)([^)"']+)\1\s*\)/gi,
    (_match: string, quote: string, value: string): string =>
      `url(${quote}${replaceAssetValue(value, blocked)}${quote})`,
  )
  return { blocked: blocked.count, html: scrubbed }
}
