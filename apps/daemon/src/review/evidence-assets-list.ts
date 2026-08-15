import { lstat, readdir, readFile } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { isSafeExternalUrl } from '../fs/external-url'
import { imageMimeForPath } from '../fs/image-mime'

/**
 * The Assets sub-tab of Evidence: `active-review/evidence/assets/` read as a
 * plain directory of images, videos, and `.url` link files, rendered as a native
 * gallery.
 *
 * A captured media file is not a document. Wrapping one in HTML just to show it
 * costs an iframe, a manifest, and another base64 copy inside a report — so the
 * gallery reads the directory directly and each asset is fetched on demand, one
 * procedure call per asset, as a data URL over tRPC.
 *
 * **There is deliberately no HTTP route for these bytes.** The daemon's static
 * server serves the renderer dist and nothing else, unauthenticated by design;
 * a route that streamed user files would be a read surface outside the Bearer
 * gate. Assets ride the authenticated tRPC channel like every other read.
 */

/** Enough for a real capture session; a bound so a stray directory cannot hang the tab. */
export const MAX_ASSETS = 60

/**
 * Per-asset ceiling for the data URL. Matches the doc-set total: media that
 * cannot be served still LISTS (name, size, type) so the gallery says what is
 * there rather than pretending the pack is smaller than it is.
 */
export const MAX_ASSET_BYTES = 8 * 1024 * 1024

/** Link files are intentionally tiny: one URL, not an arbitrary text payload. */
export const MAX_LINK_BYTES = 8 * 1024

export type EvidenceAssetKind = 'image' | 'video' | 'link'

export interface EvidenceMediaAsset {
  /** File name — the gallery key and the `readEvidenceAsset` argument. */
  file: string
  label: string
  mime: string
  kind: 'image' | 'video'
  bytes: number
}

export interface EvidenceLinkAsset {
  /** File name — the gallery key and the `readEvidenceAsset` argument. */
  file: string
  label: string
  kind: 'link'
  href: string
  bytes: number
}

export type EvidenceAsset = EvidenceMediaAsset | EvidenceLinkAsset

export interface EvidenceAssetBody {
  file: string
  mime: string
  bytes: number
  dataUrl: string
}

/**
 * A file name and nothing else — no directory part, no traversal, no dotfile.
 * These names come back from a client and reach `readFile`.
 */
function isPlainFileName(name: string): boolean {
  return name !== '' && !name.includes('/') && !name.includes('\\') && !name.startsWith('.')
}

/** `01-before.png` → "01 before"; `login_flow.png` → "Login flow". */
function labelFor(file: string): string {
  const base = file.slice(0, file.length - extname(file).length).replace(/[-_]+/g, ' ')
  return base.charAt(0).toUpperCase() + base.slice(1)
}

const VIDEO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
  webm: 'video/webm',
}

function mediaForPath(file: string): { kind: 'image' | 'video'; mime: string } | null {
  const imageMime = imageMimeForPath(file)
  if (imageMime !== null) return { kind: 'image', mime: imageMime }

  const base = file.split(/[/\\]/).at(-1) ?? file
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return null
  const mime = VIDEO_MIME[base.slice(dot + 1).toLowerCase()]
  return mime === undefined ? null : { kind: 'video', mime }
}

function isLinkFile(file: string): boolean {
  return extname(file).toLowerCase() === '.url'
}

/**
 * Resolve a client-supplied name inside `dir`. Two checks, not one: the name
 * shape, and the resolved path — the directory is agent-authored and the name
 * is client-supplied, so neither is trusted on its own.
 */
function assetPath(dir: string, file: string): string | null {
  if (!isPlainFileName(file)) return null
  const root = resolve(dir)
  const candidate = resolve(root, file)
  const rel = relative(root, candidate)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null
  return candidate
}

/**
 * The assets in an evidence assets directory, name-sorted. Unsupported files are
 * silently ignored (a stray `notes.txt` is not a broken tile), and a missing
 * directory reads as an empty gallery.
 */
export async function listEvidenceAssets(dir: string): Promise<EvidenceAsset[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const assets: EvidenceAsset[] = []
  for (const file of entries.sort()) {
    if (assets.length >= MAX_ASSETS) break
    if (!isPlainFileName(file)) continue
    const media = mediaForPath(file)
    const link = isLinkFile(file)
    if (media === null && !link) continue
    try {
      // lstat, not stat: a symlink named with an image extension must not be
      // listed as a real tile just because its target happens to be one.
      const info = await lstat(join(dir, file))
      if (info.isSymbolicLink() || !info.isFile()) continue
      if (media !== null) {
        assets.push({ file, label: labelFor(file), ...media, bytes: info.size })
        continue
      }
      if (info.size > MAX_LINK_BYTES) continue
      const href = (await readFile(join(dir, file), 'utf8')).trim()
      if (isSafeExternalUrl(href)) {
        assets.push({ file, label: labelFor(file), kind: 'link', href, bytes: info.size })
      }
    } catch {
      // vanished mid-listing — the gallery is a snapshot, not a lock
    }
  }
  return assets
}

/**
 * One media asset as a data URL, or null when it is missing, unsupported, over
 * the cap, or the name does not resolve inside `dir`.
 */
export async function readEvidenceAsset(
  dir: string,
  file: string,
): Promise<EvidenceAssetBody | null> {
  const path = assetPath(dir, file)
  if (path === null) return null
  const media = mediaForPath(file)
  if (media === null) return null
  try {
    // lstat, not stat: `assetPath` only validates the resolved path lexically,
    // so a symlink inside `dir` would otherwise let `readFile` follow it
    // outside the containment root — reject before ever touching the target.
    const info = await lstat(path)
    if (info.isSymbolicLink()) return null
    // Stat before read: a huge file must never be pulled into memory just to
    // discover it is over the cap.
    if (!info.isFile() || info.size > MAX_ASSET_BYTES) return null
    const bytes = await readFile(path)
    return {
      file,
      mime: media.mime,
      bytes: bytes.byteLength,
      dataUrl: `data:${media.mime};base64,${bytes.toString('base64')}`,
    }
  } catch {
    return null
  }
}
