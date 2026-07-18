import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, normalize, relative, resolve, sep } from 'node:path'

/**
 * Rewrite relative `src="…"` in evidence HTML to data: URIs for files that live
 * in the evidence directory. Keeps the viewer on a fully sandboxed `srcdoc`
 * (CSP: img-src 'self' data:) while letting agents drop real PNG/JPEG siblings
 * next to index.html instead of base64-inlining through the porcelain CLI.
 *
 * Paths that escape the evidence dir, or that are absolute / remote / data:, are
 * left alone (remote still blocked by CSP; absolute file paths never load in srcdoc).
 */

const SRC_ATTR = /\b(src)\s*=\s*(["'])(?!data:|https?:|\/\/|blob:|about:)([^"']+)\2/gi

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

function mimeFor(filePath: string): string {
  const lower = filePath.toLowerCase()
  for (const [ext, mime] of Object.entries(MIME)) {
    if (lower.endsWith(ext)) return mime
  }
  return 'application/octet-stream'
}

function isInsideDir(dir: string, candidate: string): boolean {
  const rel = relative(dir, candidate)
  return rel !== '' && !rel.startsWith(`..${sep}`) && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Expand local relative image sources under `dir` into data URIs.
 * Best-effort: a missing sibling is left as-is (broken img in the viewer).
 */
export async function inlineLocalAssets(dir: string, html: string): Promise<string> {
  const root = resolve(dir)
  const matches = [...html.matchAll(SRC_ATTR)]
  if (matches.length === 0) return html

  // Unique relative paths to load once.
  const paths = new Set<string>()
  for (const m of matches) {
    const raw = m[3]?.trim()
    if (raw) paths.add(raw)
  }

  const dataUris = new Map<string, string>()
  await Promise.all(
    [...paths].map(async (raw) => {
      // Reject obvious escapes before resolve.
      if (raw.includes('\0') || normalize(raw).startsWith('..')) return
      const abs = resolve(root, raw)
      if (!isInsideDir(root, abs)) return
      try {
        const bytes = await readFile(abs)
        dataUris.set(raw, `data:${mimeFor(abs)};base64,${bytes.toString('base64')}`)
      } catch {
        // missing file — leave original src
      }
    }),
  )

  if (dataUris.size === 0) return html

  return html.replace(SRC_ATTR, (full, attr: string, quote: string, raw: string) => {
    const uri = dataUris.get(raw.trim())
    if (!uri) return full
    return `${attr}=${quote}${uri}${quote}`
  })
}

/** Directory containing the HTML file (for asset resolution). */
export function evidenceHtmlDir(indexHtmlPath: string): string {
  return dirname(indexHtmlPath)
}
