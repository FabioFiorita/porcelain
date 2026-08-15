import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectEvidenceAssetsDir } from '@shared/project-porcelain'

/** Gallery caps, matching the daemon's evidence asset lister. */
const MAX_ASSETS = 60
const MAX_ASSET_BYTES = 8 * 1024 * 1024
const MAX_LINK_BYTES = 8 * 1024

/** Extensions the gallery renders; anything else in `assets/` is not a tile. */
const MEDIA_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.bmp',
  '.avif',
])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov', '.ogv', '.webm'])
const LINK_EXTENSIONS = new Set(['.url'])
const GALLERY_EXTENSIONS = new Set([...MEDIA_EXTENSIONS, ...VIDEO_EXTENSIONS, ...LINK_EXTENSIONS])

interface EvidenceAssetEntry {
  file: string
  bytes: number
  /** Why this file will not appear as a gallery tile, when it will not. */
  warning?: string
}

function extensionOf(file: string): string {
  const dot = file.lastIndexOf('.')
  return dot <= 0 ? '' : file.slice(dot).toLowerCase()
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:'
  } catch {
    return false
  }
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * The gallery as the daemon will see it: name-sorted, with a per-file warning for
 * anything unsupported or unsafe, or refused because it exceeds a cap.
 */
export function listAssets(repoPath: string): EvidenceAssetEntry[] {
  const dir = projectEvidenceAssetsDir(repoPath)
  let names: string[]
  try {
    names = readdirSync(dir).sort()
  } catch {
    return []
  }
  const out: EvidenceAssetEntry[] = []
  let galleryAssets = 0
  for (const file of names) {
    let bytes = 0
    let symbolicLink = false
    try {
      // lstat, not stat, exactly like the daemon's lister: a symlink named with
      // a media extension must not preview as a real tile it will never be.
      const info = lstatSync(join(dir, file))
      symbolicLink = info.isSymbolicLink()
      if (!symbolicLink && !info.isFile()) continue
      bytes = info.size
    } catch {
      continue
    }
    if (file.startsWith('.')) {
      out.push({ file, bytes, warning: 'dotfile — never listed' })
      continue
    }
    if (symbolicLink) {
      out.push({ file, bytes, warning: 'symlink — never listed by the gallery' })
      continue
    }
    const extension = extensionOf(file)
    if (!GALLERY_EXTENSIONS.has(extension)) {
      out.push({ file, bytes, warning: 'not supported gallery content — skipped by the gallery' })
      continue
    }
    if (LINK_EXTENSIONS.has(extension)) {
      if (bytes > MAX_LINK_BYTES) {
        out.push({
          file,
          bytes,
          warning: `${bytes} bytes is over the ${MAX_LINK_BYTES}-byte link cap — it will not load`,
        })
        continue
      }
      let href = ''
      try {
        href = readFileSync(join(dir, file), 'utf8').trim()
      } catch {
        out.push({ file, bytes, warning: 'URL file disappeared — skipped by the gallery' })
        continue
      }
      if (!isSafeExternalUrl(href)) {
        out.push({ file, bytes, warning: 'unsafe or empty URL — skipped by the gallery' })
        continue
      }
    }
    galleryAssets++
    if (MEDIA_EXTENSIONS.has(extension) && bytes > MAX_ASSET_BYTES) {
      out.push({
        file,
        bytes,
        warning: `${formatMb(bytes)} is over the ${formatMb(MAX_ASSET_BYTES)} per-media cap — it lists but will not load`,
      })
      continue
    }
    if (galleryAssets > MAX_ASSETS) {
      out.push({ file, bytes, warning: `past the ${MAX_ASSETS}-asset gallery cap — not shown` })
      continue
    }
    out.push({ file, bytes })
  }
  return out
}

/** cli.ts's `evidence assets-list` case body, pulled in whole to keep that file lean. */
export function describeAssets(repoPath: string): string {
  const assets = listAssets(repoPath)
  if (assets.length === 0) {
    return `No evidence assets for ${repoPath}. Drop screenshots in the pack's assets/ directory — \`evidence prepare\` prints the path.`
  }
  const rows = assets
    .map(
      (a) =>
        `  ${a.file}  ${(a.bytes / 1024).toFixed(0)} KB${a.warning === undefined ? '' : `  — WARNING: ${a.warning}`}`,
    )
    .join('\n')
  const shown = assets.filter((a) => a.warning === undefined).length
  return `Evidence assets for ${repoPath} (${shown} in the gallery of ${assets.length} file(s)):\n${rows}`
}
