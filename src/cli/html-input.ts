import { readFileSync, statSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

// Builtins only — see cli.ts. Used by `evidence set` so agents can pass a local
// file path (--html-file) instead of inlining multi-hundred-KB HTML
// (base64 screenshots) as --html, which is slow and fragile.

/**
 * Below this an `--html` value is almost certainly a stray fragment or a file path an
 * agent pasted into the flag (the "filePath:/tmp/…" junk-write bug), not a real
 * self-contained document. The guard catches that before it's stored verbatim.
 */
export const MIN_HTML_BYTES = 512

/**
 * Resolve the document body for `evidence set`. Exactly one of
 * `--html` (inline string) or `--html-file` (absolute path the CLI reads locally)
 * is required. Prefer `--html-file` for anything with embedded screenshots — the
 * agent writes the file, then passes the path.
 */
export function resolveToolHtml(args: Record<string, unknown>, maxBytes: number): string {
  const html = typeof args.html === 'string' ? args.html : undefined
  const htmlFile = typeof args.htmlFile === 'string' ? args.htmlFile.trim() : undefined
  const hasHtml = html !== undefined && html.length > 0
  const hasFile = htmlFile !== undefined && htmlFile.length > 0
  if (hasHtml && hasFile) {
    throw new Error('provide --html or --html-file, not both')
  }
  if (!hasHtml && !hasFile) {
    throw new Error('--html or --html-file is required')
  }
  // hasHtml — non-empty string; size still enforced by validateEvidence.
  const content = hasFile ? readHtmlFile(htmlFile, maxBytes) : (html as string)
  assertPlausibleHtml(content)
  return content
}

/**
 * Reject an html value that plainly isn't an HTML document: content with no `<` tag
 * near the start (a bare file path or plain string) or one implausibly small for a
 * real document. Guards the silent junk-write where an agent passes a path/prefix
 * (e.g. "filePath:/tmp/…") in --html and it gets stored verbatim.
 */
export function assertPlausibleHtml(html: string): void {
  if (!html.slice(0, 256).includes('<')) {
    throw new Error(
      'html doesn\'t look like an HTML document (no "<" tag near the start). If you meant to point at a file on disk, pass its ABSOLUTE path with --html-file — a path does not belong in --html.',
    )
  }
  const bytes = Buffer.byteLength(html, 'utf8')
  if (bytes < MIN_HTML_BYTES) {
    throw new Error(
      `html is only ${bytes} bytes — too small to be a real self-contained document (expected at least ${MIN_HTML_BYTES}). If you meant to reference a file on disk, pass its absolute path with --html-file; otherwise send the full HTML document.`,
    )
  }
}

/**
 * A short, whitespace-collapsed preview of stored HTML for the `get` commands, so an
 * agent can confirm what was actually stored — not just its size (the junk-write above
 * had a plausible byte count but garbage content).
 */
export function htmlPreview(html: string, max = 200): string {
  const collapsed = html.replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed
}

/** Read a local HTML document for `--html-file`. Absolute path only; size-capped. */
export function readHtmlFile(path: string, maxBytes: number): string {
  if (!isAbsolute(path)) {
    throw new Error(`--html-file must be an absolute path, got "${path}"`)
  }
  const resolved = resolve(path)
  let size: number
  try {
    size = statSync(resolved).size
  } catch {
    throw new Error(`--html-file not found or unreadable: ${resolved}`)
  }
  // Refuse before reading so a multi-GB path cannot OOM the CLI process.
  if (size > maxBytes) {
    throw new Error(
      `--html-file is ${size} bytes, over the ${maxBytes}-byte limit — slim it down (drop or shrink embedded images/data URIs, trim the prose).`,
    )
  }
  let content: string
  try {
    content = readFileSync(resolved, 'utf8')
  } catch {
    throw new Error(`--html-file not found or unreadable: ${resolved}`)
  }
  if (content.length === 0) {
    throw new Error('--html-file is empty')
  }
  const bytes = Buffer.byteLength(content, 'utf8')
  if (bytes > maxBytes) {
    throw new Error(
      `--html-file is ${bytes} bytes, over the ${maxBytes}-byte limit — slim it down (drop or shrink embedded images/data URIs, trim the prose).`,
    )
  }
  return content
}
