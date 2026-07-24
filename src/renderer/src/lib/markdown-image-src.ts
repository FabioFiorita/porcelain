/**
 * Classify a markdown `![alt](src)` target for the Agent timeline.
 *
 * CSP is `img-src 'self' data:` — remote http(s) never loads, and absolute
 * filesystem paths never load as `<img src="/tmp/…">` either (they resolve as
 * same-origin URLs and 404). Local paths must be re-fetched through the daemon
 * (`readFile` → data URL). data: URIs pass through as-is.
 */

export type MarkdownImageSrc =
  | { kind: 'data'; src: string }
  | { kind: 'local'; path: string }
  | { kind: 'unsupported'; raw: string }

export function classifyMarkdownImageSrc(src: string | undefined | null): MarkdownImageSrc {
  if (src == null) return { kind: 'unsupported', raw: '' }
  const s = src.trim()
  if (s === '') return { kind: 'unsupported', raw: '' }
  if (s.startsWith('data:')) return { kind: 'data', src: s }
  // Absolute POSIX, home-relative, or file:// — all resolved on the daemon.
  if (s.startsWith('/') || s === '~' || s.startsWith('~/') || s.startsWith('file:')) {
    return { kind: 'local', path: s }
  }
  return { kind: 'unsupported', raw: s }
}
