import { readdir, readFile, rm, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { MAX_CHECK_DETAIL, MAX_CHECK_LABEL, MAX_CHECKS } from '@shared/evidence-check'
import {
  projectEvidenceAssetsDir,
  projectEvidenceDir,
  projectEvidenceResultsDir,
} from '@shared/project-porcelain'
import { z } from 'zod'
import {
  type DocMedium,
  MAX_DOC_BYTES,
  type ReviewDoc,
  readActiveEvidenceResults,
} from '../../review/doc-set'
import {
  listEvidenceAssets,
  MAX_ASSET_BYTES,
  readEvidenceAsset,
} from '../../review/evidence-assets-list'
import type {
  ReviewEvidenceAssetDescriptor,
  ReviewEvidenceDocDescriptor,
  ReviewEvidencePack,
  ReviewEvidenceStore,
} from './review-evidence-capabilities'

/**
 * Evidence — **files on disk are the source of truth**. The pack is three sub-tabs
 * over one directory (`…/active-review/evidence/`): **Checks** (`meta.json`),
 * **Results** (`results/`, a document set), and **Assets** (`assets/`, the gallery).
 * Any ONE of them makes a pack: an agent that ran the suite and recorded four passes
 * has evidence even without writing a page saying so.
 *
 * Nothing this adapter returns is a host path. Bodies and images are read by the two
 * modules that own their caps and containment (`review/doc-set.ts` and
 * `review/evidence-assets-list.ts`); this module owns presence, freshness, and the
 * descriptors the feature reads.
 */

const checkSchema = z.object({
  label: z.string().min(1).max(MAX_CHECK_LABEL),
  status: z.enum(['pass', 'fail', 'skip']),
  detail: z.string().max(MAX_CHECK_DETAIL).optional(),
})

const metaSchema = z.object({
  title: z.string().optional(),
  repoPath: z.string().optional(),
  updatedAt: z.string().optional(),
  // Lenient: a malformed or over-cap checks list is dropped (`.catch([])`) so the
  // rest of the meta still parses — one bad write never blanks the opener.
  checks: checkSchema.array().max(MAX_CHECKS).catch([]).optional(),
})

/**
 * Mirrors `MEDIUM_BY_EXT` in `review/doc-set.ts` — the descriptor must agree with the
 * reader about what a document is, or the header promises a tab that is not there.
 */
const MEDIUM_BY_EXT: Record<string, DocMedium> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.htm': 'html',
}

function mediumFor(file: string): DocMedium | null {
  return MEDIUM_BY_EXT[extname(file).toLowerCase()] ?? null
}

/** Renderable document names in a `results/` directory (dotfiles excluded). */
function isResultDoc(name: string): boolean {
  return !name.startsWith('.') && mediumFor(name) !== null
}

/** `index.md` → "Index"; `data-flow.html` → "Data flow". The doc-set derivation. */
function labelFor(file: string): string {
  const base = file.slice(0, file.length - extname(file).length).replace(/[-_]+/g, ' ')
  return base.charAt(0).toUpperCase() + base.slice(1)
}

function metaPath(repoPath: string): string {
  return join(projectEvidenceDir(repoPath), 'meta.json')
}

/**
 * A descriptor says up front whether the body fetch can serve it. The readers drop
 * an over-cap document and refuse an over-cap image, so a pack that only listed
 * available files would quietly under-report what the agent produced.
 */
function stateFor(
  bytes: number,
  maxBytes: number,
): { state: 'available' } | { state: 'unavailable'; reason: 'too-large'; maxBytes: number } {
  return bytes > maxBytes
    ? { state: 'unavailable', reason: 'too-large', maxBytes }
    : { state: 'available' }
}

async function readDiskMeta(repoPath: string): Promise<z.infer<typeof metaSchema> | null> {
  try {
    return metaSchema.parse(JSON.parse(await readFile(metaPath(repoPath), 'utf8')))
  } catch {
    return null
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function mtimeOf(path: string): Promise<string> {
  try {
    return (await stat(path)).mtime.toISOString()
  } catch {
    return ''
  }
}

type ResultsScan = { docs: ReviewEvidenceDocDescriptor[]; newestAt: string }

/**
 * The Results descriptors, name-sorted, with the bytes the same `stat` already read.
 * A missing directory is an empty set, and an entry that vanishes mid-scan is skipped
 * — the descriptor list is a snapshot, not a lock.
 */
async function scanResults(dir: string): Promise<ResultsScan> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return { docs: [], newestAt: '' }
  }
  const docs: ReviewEvidenceDocDescriptor[] = []
  let newestAt = ''
  for (const file of entries.sort()) {
    if (!isResultDoc(file)) continue
    const medium = mediumFor(file)
    if (medium === null) continue
    try {
      const info = await stat(join(dir, file))
      if (!info.isFile()) continue
      docs.push({
        file,
        label: labelFor(file),
        medium,
        bytes: info.size,
        ...stateFor(info.size, MAX_DOC_BYTES),
      })
      const at = info.mtime.toISOString()
      if (at > newestAt) newestAt = at
    } catch {
      // vanished mid-scan
    }
  }
  return { docs, newestAt }
}

/** Newest mtime among the images the gallery actually lists. */
async function newestAssetAt(dir: string, files: readonly string[]): Promise<string> {
  let newestAt = ''
  for (const file of files) {
    const at = await mtimeOf(join(dir, file))
    if (at > newestAt) newestAt = at
  }
  return newestAt
}

/**
 * The single owner of the evidence pack directory. Presence keys off the meta FILE,
 * not a successful parse, so a half-written `meta.json` shows an empty pack rather
 * than making the whole thing vanish mid-write.
 */
export function createFsReviewEvidenceStore(): ReviewEvidenceStore {
  return Object.freeze({
    readPack: async (repoPath: string): Promise<ReviewEvidencePack | null> => {
      const assetsDir = projectEvidenceAssetsDir(repoPath)
      const [results, assets, hasMeta] = await Promise.all([
        scanResults(projectEvidenceResultsDir(repoPath)),
        // One scan serves both the gallery and the count: the header must never
        // promise a tile the gallery refuses to show (symlinks, past MAX_ASSETS).
        listEvidenceAssets(assetsDir),
        fileExists(metaPath(repoPath)),
      ])
      // A pack exists when ANY of its parts does: recorded checks (`meta.json`), a
      // Results document, or a gallery image.
      if (!hasMeta && results.docs.length === 0 && assets.length === 0) return null

      const meta = await readDiskMeta(repoPath)
      // Effective stamp: the latest of meta.updatedAt and the newest file under
      // `results/` / `assets/`. An in-place edit (a `sed`, an agent dropping a
      // screenshot in) must invalidate even when nothing re-bumped `meta.json`.
      let updatedAt = meta?.updatedAt?.trim() || ''
      for (const at of [
        results.newestAt,
        await newestAssetAt(
          assetsDir,
          assets.map((asset) => asset.file),
        ),
      ]) {
        if (at > updatedAt) updatedAt = at
      }

      const assetDescriptors: ReviewEvidenceAssetDescriptor[] = assets.map((asset) => ({
        ...asset,
        ...stateFor(asset.bytes, MAX_ASSET_BYTES),
      }))

      return {
        title: meta?.title?.trim() || 'Evidence',
        updatedAt,
        checks: meta?.checks ?? [],
        results: results.docs,
        assets: assetDescriptors,
      }
    },

    readResults: (repoPath: string): Promise<ReviewDoc[]> => readActiveEvidenceResults(repoPath),

    readAsset: (repoPath: string, file: string) =>
      readEvidenceAsset(projectEvidenceAssetsDir(repoPath), file),

    clear: async (repoPath: string): Promise<void> => {
      // `force` already absorbs "no pack", so anything left is a real failure the
      // caller must hear about rather than a silent no-op clear.
      await rm(projectEvidenceDir(repoPath), { recursive: true, force: true })
    },
  })
}
