import { readFile } from 'node:fs/promises'
import { isAbsolute, normalize, relative, resolve, sep } from 'node:path'

/**
 * Inline relative image sources and stylesheet links for files that live in the
 * evidence directory. Keeps the viewer on a fully sandboxed `srcdoc` while
 * letting agents drop real PNG/JPEG/CSS siblings next to index.html instead of
 * base64-inlining them through the porcelain CLI.
 *
 * Paths that escape the evidence dir, or that are absolute / remote / data:, are
 * left alone (remote still blocked by CSP; absolute file paths never load in srcdoc).
 */

const SRC_ATTR = /\bsrc\s*=\s*(["'])([^"']+)\1/gi
const LINK_TAG = /<link\b[^>]*>/gi

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

function attributeValue(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null
}

function localAssetPath(root: string, raw: string): string | null {
  const value = raw.trim()
  if (
    value === '' ||
    value.includes('\0') ||
    /^(?:data:|https?:|\/\/|blob:|about:|file:)/i.test(value) ||
    normalize(value).startsWith('..')
  ) {
    return null
  }
  const candidate = resolve(root, value)
  return isInsideDir(root, candidate) ? candidate : null
}

function stylesheetHref(tag: string): string | null {
  const rel = attributeValue(tag, 'rel')
  if (!rel?.split(/\s+/).some((value) => value.toLowerCase() === 'stylesheet')) return null
  return attributeValue(tag, 'href')?.trim() ?? null
}

function escapeStyleText(css: string): string {
  // A literal closing tag in a stylesheet would terminate the injected raw-text
  // element before the rest of the CSS reaches the sandboxed document.
  return css.replace(/<\/style/gi, '<\\/style')
}

/**
 * Expand local relative image sources under `dir` into data URIs.
 * Best-effort: a missing sibling is left as-is (broken img in the viewer).
 */
export async function inlineLocalAssets(dir: string, html: string): Promise<string> {
  const root = resolve(dir)
  const matches = [...html.matchAll(SRC_ATTR)]
  const stylesheetMatches = [...html.matchAll(LINK_TAG)]

  // Unique relative paths to load once.
  const paths = new Set<string>()
  for (const m of matches) {
    const raw = m[2]?.trim()
    if (raw) paths.add(raw)
  }

  const dataUris = new Map<string, string>()
  await Promise.all(
    [...paths].map(async (raw) => {
      const abs = localAssetPath(root, raw)
      if (abs === null) return
      try {
        const bytes = await readFile(abs)
        dataUris.set(raw, `data:${mimeFor(abs)};base64,${bytes.toString('base64')}`)
      } catch {
        // missing file — leave original src
      }
    }),
  )

  const stylesheetPaths = new Set<string>()
  for (const match of stylesheetMatches) {
    const raw = stylesheetHref(match[0] ?? '')
    if (raw) stylesheetPaths.add(raw)
  }

  const stylesheets = new Map<string, string>()
  await Promise.all(
    [...stylesheetPaths].map(async (raw) => {
      const abs = localAssetPath(root, raw)
      if (abs === null) return
      try {
        stylesheets.set(raw, await readFile(abs, 'utf8'))
      } catch {
        // missing stylesheet — leave the original link so the preview stays honest
      }
    }),
  )

  let output = html.replace(LINK_TAG, (full) => {
    const raw = stylesheetHref(full)
    const stylesheet = raw === null ? undefined : stylesheets.get(raw)
    if (stylesheet === undefined) return full
    return `<style data-porcelain-inlined-stylesheet="true">${escapeStyleText(stylesheet)}</style>`
  })

  if (dataUris.size > 0) {
    output = output.replace(SRC_ATTR, (full, quote: string, raw: string) => {
      const uri = dataUris.get(raw.trim())
      if (!uri) return full
      return `src=${quote}${uri}${quote}`
    })
  }

  return output
}
