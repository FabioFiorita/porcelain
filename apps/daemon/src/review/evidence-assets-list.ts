import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { imageMimeForPath } from '../fs/image-mime'

/**
 * The Assets sub-tab of Evidence: `active-review/evidence/assets/` read as a
 * plain directory of images, rendered as a native gallery.
 *
 * A screenshot is not a document. Wrapping one in HTML just to show it costs an
 * iframe, a manifest, and a base64 copy inside a report — so the gallery reads
 * the directory directly and each image is fetched on demand, one procedure call
 * per image, as a data URL over tRPC.
 *
 * **There is deliberately no HTTP route for these bytes.** The daemon's static
 * server serves the renderer dist and nothing else, unauthenticated by design;
 * a route that streamed user files would be a read surface outside the Bearer
 * gate. Assets ride the authenticated tRPC channel like every other read.
 */

/** Enough for a real capture session; a bound so a stray directory cannot hang the tab. */
export const MAX_ASSETS = 60

/**
 * Per-image ceiling for the data URL. Matches the doc-set total: an image that
 * cannot be served still LISTS (name, size, type) so the gallery says what is
 * there rather than pretending the pack is smaller than it is.
 */
export const MAX_ASSET_BYTES = 8 * 1024 * 1024

export interface EvidenceAsset {
  /** File name — the gallery key and the `readEvidenceAsset` argument. */
  file: string
  label: string
  mime: string
  /** Only images today; the field exists so a second kind is additive. */
  kind: 'image'
  bytes: number
}

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
 * The images in an evidence assets directory, name-sorted. Non-images are
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
    const mime = imageMimeForPath(file)
    if (mime === null) continue
    try {
      const info = await stat(join(dir, file))
      if (!info.isFile()) continue
      assets.push({ file, label: labelFor(file), mime, kind: 'image', bytes: info.size })
    } catch {
      // vanished mid-listing — the gallery is a snapshot, not a lock
    }
  }
  return assets
}

/**
 * One image as a data URL, or null when it is missing, not an image, over the
 * cap, or the name does not resolve inside `dir`.
 */
export async function readEvidenceAsset(
  dir: string,
  file: string,
): Promise<EvidenceAssetBody | null> {
  const path = assetPath(dir, file)
  if (path === null) return null
  const mime = imageMimeForPath(file)
  if (mime === null) return null
  try {
    const info = await stat(path)
    // Stat before read: a huge file must never be pulled into memory just to
    // discover it is over the cap.
    if (!info.isFile() || info.size > MAX_ASSET_BYTES) return null
    const bytes = await readFile(path)
    return {
      file,
      mime,
      bytes: bytes.byteLength,
      dataUrl: `data:${mime};base64,${bytes.toString('base64')}`,
    }
  } catch {
    return null
  }
}
