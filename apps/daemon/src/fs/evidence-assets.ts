import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/**
 * Inline relative image sources and stylesheet links for a document that lives
 * in a review directory. Keeps the viewer on a fully sandboxed `srcdoc` while
 * letting agents drop real PNG/JPEG/CSS siblings beside the document instead of
 * base64-inlining them through the porcelain CLI.
 *
 * Two roots, deliberately: references resolve relative to the document's own
 * directory, but containment is checked against `root`. A Results document sits
 * one level down and points at `../assets/shot.png` — the same gallery the
 * Assets tab lists — so the pack keeps ONE copy of each image.
 *
 * Lexical pre-gate uses path.relative (not startsWith('..'), so names like
 * `..foo` are not false-outside). Before every host read, candidates are
 * realpath-checked against the real root so symlink escapes are left alone.
 *
 * Paths that escape `root`, or that are absolute / remote / data:, are left
 * alone (remote still blocked by CSP; absolute file paths never load in srcdoc).
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

/** Exact outside rule — never startsWith('..') alone (that false-positives `..foo`). */
function isInsideDir(dir: string, candidate: string): boolean {
  const rel = relative(dir, candidate)
  if (rel === '') return false
  return !(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
}

function attributeValue(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null
}

function localAssetPath(base: string, root: string, raw: string): string | null {
  const value = raw.trim()
  if (
    value === '' ||
    value.includes('\0') ||
    /^(?:data:|https?:|\/\/|blob:|about:|file:)/i.test(value)
  ) {
    return null
  }
  const candidate = resolve(base, value)
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

async function readContainedAsset(
  base: string,
  root: string,
  rootReal: string,
  raw: string,
): Promise<{ lexical: string; bytes: Buffer } | null> {
  const candidateLexical = localAssetPath(base, root, raw)
  if (candidateLexical === null) return null
  try {
    const candidateReal = await realpath(candidateLexical)
    if (!isInsideDir(rootReal, candidateReal)) return null
    // Read the contained real target; MIME identity stays on the lexical name.
    const bytes = await readFile(candidateReal)
    return { lexical: candidateLexical, bytes }
  } catch {
    // missing / dangling / ELOOP — leave original reference alone
    return null
  }
}

/**
 * Expand local relative image sources into data URIs. References resolve
 * against `dir`; `root` (defaulting to `dir`) is the boundary they may not
 * leave. Best-effort: a missing sibling is left as-is (broken img in the viewer).
 */
export async function inlineLocalAssets(
  dir: string,
  html: string,
  rootDir: string = dir,
): Promise<string> {
  const base = resolve(dir)
  const root = resolve(rootDir)
  let rootReal: string
  try {
    rootReal = await realpath(root)
  } catch {
    // Unusable root: leave every asset alone (same as total read failure).
    return html
  }

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
      const asset = await readContainedAsset(base, root, rootReal, raw)
      if (asset === null) return
      dataUris.set(raw, `data:${mimeFor(asset.lexical)};base64,${asset.bytes.toString('base64')}`)
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
      const asset = await readContainedAsset(base, root, rootReal, raw)
      if (asset === null) return
      stylesheets.set(raw, asset.bytes.toString('utf8'))
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
