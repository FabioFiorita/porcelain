import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/**
 * Inline relative image sources, stylesheet links, and empty external script
 * tags for a document that lives in a review or Canvas directory. Keeps the
 * viewer on a fully sandboxed `srcdoc` while letting agents drop real
 * PNG/JPEG/CSS/JS siblings beside the document instead of base64-inlining them
 * through the daemon's MCP tools.
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
// Only an EMPTY external script element (the only form a browser actually runs
// off `src`) — a tag authored with both `src` and a body is left untouched, same
// as any other reference this function can't confidently rewrite.
const SCRIPT_SRC_TAG = /<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>\s*<\/script\s*>/gi
// Any script OPENING tag with a `src`, body or not — used only to keep the
// generic image pass below from mistaking a script's `src` for an `<img>` one.
const SCRIPT_TAG_OPEN = /<script\b[^>]*>/gi

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.ogv': 'video/ogg',
  '.webm': 'video/webm',
}

export function mimeFor(filePath: string): string {
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

/** `src` values already spoken for by a `<script>` tag — a body or a failed read both leave one. */
function scriptTagSrcValues(html: string): Set<string> {
  const values = new Set<string>()
  for (const match of html.matchAll(SCRIPT_TAG_OPEN)) {
    const raw = attributeValue(match[0], 'src')?.trim()
    if (raw) values.add(raw)
  }
  return values
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

function escapeScriptText(js: string): string {
  // Same trap as escapeStyleText, one raw-text element over.
  return js.replace(/<\/script/gi, '<\\/script')
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
 *
 * `inlineScripts` defaults false. Normal document readers render through a
 * sandbox with no allow-scripts; only Canvas (canvas-operations.ts), whose
 * iframe actually has allow-scripts, opts in.
 */
export async function inlineLocalAssets(
  dir: string,
  html: string,
  rootDir: string = dir,
  inlineScripts = false,
  inlineMedia = true,
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

  // Scripts inline FIRST and rewrite `output`, not `html`: once a matched tag's
  // `src` attribute is gone, the generic image pass below can no longer mistake
  // it for an `<img>` reference. A script whose file can't be read is left
  // exactly as authored, `src` intact, so ordering never double-processes it.
  let output = html
  if (inlineScripts) {
    const scriptMatches = [...html.matchAll(SCRIPT_SRC_TAG)]
    const scriptPaths = new Set<string>()
    for (const m of scriptMatches) {
      const raw = m[2]?.trim()
      if (raw) scriptPaths.add(raw)
    }
    const scripts = new Map<string, string>()
    await Promise.all(
      [...scriptPaths].map(async (raw) => {
        const asset = await readContainedAsset(base, root, rootReal, raw)
        if (asset === null) return
        scripts.set(raw, asset.bytes.toString('utf8'))
      }),
    )
    output = html.replace(SCRIPT_SRC_TAG, (full, _quote: string, raw: string) => {
      const script = scripts.get(raw.trim())
      if (script === undefined) return full
      return `<script>${escapeScriptText(script)}</script>`
    })
  }

  const stylesheetMatches = [...output.matchAll(LINK_TAG)]
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

  output = output.replace(LINK_TAG, (full) => {
    const raw = stylesheetHref(full)
    const stylesheet = raw === null ? undefined : stylesheets.get(raw)
    if (stylesheet === undefined) return full
    return `<style data-porcelain-inlined-stylesheet="true">${escapeStyleText(stylesheet)}</style>`
  })

  // Whatever `<script src>` survived inlining (a body, or a failed read) still
  // carries `src` — exclude those values so this generic pass never mistakes a
  // script reference for an image one.
  const scriptSrcValues = scriptTagSrcValues(output)

  const matches = [...output.matchAll(SRC_ATTR)]
  const paths = new Set<string>()
  for (const m of matches) {
    const raw = m[2]?.trim()
    if (raw && !scriptSrcValues.has(raw)) paths.add(raw)
  }

  const dataUris = new Map<string, string>()
  await Promise.all(
    [...paths].map(async (raw) => {
      const asset = await readContainedAsset(base, root, rootReal, raw)
      if (asset === null) return
      const mime = mimeFor(asset.lexical)
      if (!inlineMedia && (mime.startsWith('video/') || mime.startsWith('audio/'))) return
      dataUris.set(raw, `data:${mime};base64,${asset.bytes.toString('base64')}`)
    }),
  )

  if (dataUris.size > 0) {
    output = output.replace(SRC_ATTR, (full, quote: string, raw: string) => {
      const trimmed = raw.trim()
      if (scriptSrcValues.has(trimmed)) return full
      const uri = dataUris.get(trimmed)
      if (!uri) return full
      return `src=${quote}${uri}${quote}`
    })
  }

  return output
}
