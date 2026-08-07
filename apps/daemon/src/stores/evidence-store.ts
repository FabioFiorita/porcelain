import { readdir, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  type EvidenceCheck,
  MAX_CHECK_DETAIL,
  MAX_CHECK_LABEL,
  MAX_CHECKS,
} from '@shared/evidence-check'
import { projectEvidenceAssetsDir, projectEvidenceResultsDir } from '@shared/project-porcelain'
import { z } from 'zod'
import { inlineLocalAssets } from '../fs/evidence-assets'
import { evidenceDirForRepo, evidenceIndexPath, evidenceMetaPath } from '../fs/evidence-paths'
import { imageMimeForPath } from '../fs/image-mime'

// Structured checks live in the node-free `@shared/evidence-check` leaf so the
// renderer can import the shape + `evidenceOverallStatus` without pulling this
// module's fs graph; re-exported here so backend/test callers use one entry.
export { type EvidenceCheck, evidenceOverallStatus } from '@shared/evidence-check'

/**
 * Evidence — **files on disk are the source of truth**. The pack is three
 * sub-tabs over one directory (`…/active-review/evidence/`):
 *
 * - **Checks** — `meta.json` (title + structured checks),
 * - **Results** — `results/`, a document set (see `review/doc-set.ts`),
 * - **Assets** — `assets/`, images listed as a gallery (`review/evidence-assets-list.ts`).
 *
 * Any ONE of them makes a pack. The old gate — "there is an index.html" — hid a
 * checks-only pack completely: an agent that ran the suite and recorded four
 * passes saw "no evidence yet" unless it also wrote a page saying so. Legacy
 * `index.html` still counts, and still renders (as the Results tab's "Report").
 *
 * Agents write with normal Write tools; the app inlines relative images for the
 * sandboxed viewer and clears by deleting the directory (or archives it with the
 * review). See `evidence-paths.ts`.
 */

/**
 * Read-side cap on the inlined HTML — deliberately higher than the CLI `set`
 * payload cap (1.5 MB), because sibling screenshots are inlined as data: URIs
 * here. Keep in lockstep with `READ_MAX_HTML_BYTES` in
 * `src/cli/evidence-file.ts`, which warns against the same ceiling.
 */
export const MAX_HTML_BYTES = 4_194_304

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

type EvidenceMedium = 'html'

/**
 * Why the HTML body exists on disk but is not served to the sandboxed viewer.
 * Distinct from `null` evidence (cleared / never published).
 */
type EvidenceHtmlUnavailable = {
  reason: 'too-large'
  /** Byte size that exceeded the cap (raw index.html or post-inline). */
  bytes: number
  maxBytes: number
}

export type Evidence = {
  title: string
  updatedAt: string
  /** Absolute directory (for "open in browser" / Reveal). */
  dir?: string
  /** Structured verification checks (empty when none were recorded). */
  checks: EvidenceCheck[]
  /** Always HTML for evidence. */
  medium: EvidenceMedium
  /** Inlined for the sandboxed iframe. Absent when over-cap or empty. */
  html?: string
  /**
   * Present when the pack exists (title/checks still valid) but the HTML body
   * cannot be served — never collapse this into `null` (that looks "cleared").
   */
  htmlUnavailable?: EvidenceHtmlUnavailable
}

export type EvidenceMeta = {
  title: string
  updatedAt: string
  checks: EvidenceCheck[]
  dir?: string
  /**
   * @deprecated Evidence is no longer one medium. Installed mobile clients parse
   * this as a required literal, so it keeps being emitted; drop it one release
   * after mobile ships the widened schema.
   */
  medium: EvidenceMedium
  /** Documents in `results/` — how many tabs the Results sub-tab will have. */
  results?: number
  /** Images in `assets/` — how many tiles the Assets gallery will have. */
  assets?: number
  /** A legacy `index.html` is present, surfaced as the "Report" document. */
  hasReport?: boolean
}

// Re-export path helpers so callers (review-watch, e2e) use one place.
export { evidenceDirForRepo, loopEvidenceRoot } from '../fs/evidence-paths'

async function readDiskMeta(repoPath: string): Promise<z.infer<typeof metaSchema> | null> {
  try {
    return metaSchema.parse(JSON.parse(await readFile(evidenceMetaPath(repoPath), 'utf8')))
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

// Mirrors `MEDIUM_BY_EXT` in `review/doc-set.ts` — the counter must agree with
// the reader about what a document is, or the header promises a tab that is not there.
const RESULT_EXT = /\.(?:md|markdown|html?)$/i

/** Renderable document names in a `results/` directory (dotfiles excluded). */
function isResultDoc(name: string): boolean {
  return !name.startsWith('.') && RESULT_EXT.test(name)
}

interface PackShape {
  hasMeta: boolean
  hasReport: boolean
  results: number
  assets: number
  /** Newest mtime seen under `results/` and `assets/`, ISO or ''. */
  newestAt: string
}

/** Names + newest mtime for one sub-directory, matching `keep`. Missing dir → zero. */
async function scanSubdir(
  dir: string,
  keep: (name: string) => boolean,
): Promise<{ count: number; newestAt: string }> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return { count: 0, newestAt: '' }
  }
  let count = 0
  let newestAt = ''
  for (const name of entries) {
    if (!keep(name)) continue
    try {
      const info = await stat(join(dir, name))
      if (!info.isFile()) continue
      count += 1
      const at = info.mtime.toISOString()
      if (at > newestAt) newestAt = at
    } catch {
      // vanished mid-scan — the count is a snapshot
    }
  }
  return { count, newestAt }
}

/** What the pack actually holds. One stat/readdir pass, reused by every reader. */
async function readPackShape(repoPath: string): Promise<PackShape> {
  const [results, assets, hasReport, hasMeta] = await Promise.all([
    scanSubdir(projectEvidenceResultsDir(repoPath), isResultDoc),
    scanSubdir(projectEvidenceAssetsDir(repoPath), (n) => imageMimeForPath(n) !== null),
    fileExists(evidenceIndexPath(repoPath)),
    fileExists(evidenceMetaPath(repoPath)),
  ])
  const newestAt = results.newestAt > assets.newestAt ? results.newestAt : assets.newestAt
  return { hasMeta, hasReport, results: results.count, assets: assets.count, newestAt }
}

/**
 * A pack exists when ANY of its parts does: recorded checks (`meta.json`), a
 * Results document, a gallery image, or a legacy `index.html`. Checks alone is
 * a complete, honest evidence pack — it used to be invisible. Presence keys off
 * the meta FILE, not a successful parse, so a half-written `meta.json` shows an
 * empty pack rather than making the whole thing vanish mid-write.
 */
function evidencePackExists(shape: PackShape): boolean {
  return shape.hasMeta || shape.hasReport || shape.results > 0 || shape.assets > 0
}

/**
 * Effective stamp for the evidence pack: the latest of meta.updatedAt, the
 * legacy index.html mtime, and the newest file under `results/` / `assets/`.
 * In-place edits (sed, an agent dropping a screenshot in) must invalidate even
 * when `evidence check` never re-bumped meta.
 */
async function resolveUpdatedAt(
  bodyPath: string,
  meta: z.infer<typeof metaSchema> | null,
  shape?: PackShape,
): Promise<string> {
  let latest = meta?.updatedAt?.trim() || ''
  const consider = (at: string): void => {
    if (at > latest) latest = at
  }
  try {
    consider((await stat(bodyPath)).mtime.toISOString())
  } catch {
    // missing body
  }
  if (shape) consider(shape.newestAt)
  return latest
}

function tooLarge(bytes: number): EvidenceHtmlUnavailable {
  return { reason: 'too-large', bytes, maxBytes: MAX_HTML_BYTES }
}

/**
 * Prefer on-disk index.html — `results/index.html` (current layout) first, then
 * the legacy root `index.html`, same precedence as the CLI's own `getEvidence`.
 * This procedure (`loopEvidenceHtml`) is what an installed client not yet on the
 * Results/Assets split still calls; a pack written by the current CLI, which no
 * longer writes the legacy root, must keep answering it or a staggered
 * daemon/client upgrade shows "cleared" for a pack that fully exists.
 * Oversized bodies keep title/checks and surface `htmlUnavailable` (never
 * silent null — that looked like "cleared"). Malformed / empty index → null.
 * No index.html anywhere — including an old scene-only evidence pack from
 * before HTML was the only medium — is not treated as evidence at all;
 * rewrite it as HTML.
 */
export async function readEvidence(repoPath: string): Promise<Evidence | null> {
  const dir = evidenceDirForRepo(repoPath)
  const resultsDir = projectEvidenceResultsDir(repoPath)
  const resultsIndexPath = join(resultsDir, 'index.html')
  const legacyIndexPath = evidenceIndexPath(repoPath)
  const useResults = await fileExists(resultsIndexPath)
  const indexPath = useResults ? resultsIndexPath : legacyIndexPath
  if (!useResults && !(await fileExists(legacyIndexPath))) return null

  const meta = await readDiskMeta(repoPath)
  const checks = meta?.checks ?? []
  const title = meta?.title?.trim() || 'Evidence'

  try {
    const raw = await readFile(indexPath, 'utf8')
    if (raw.length === 0) return null
    const updatedAt = await resolveUpdatedAt(indexPath, meta)
    const base = {
      title,
      updatedAt,
      dir,
      checks,
      medium: 'html' as const,
    }
    const rawBytes = Buffer.byteLength(raw, 'utf8')
    if (rawBytes > MAX_HTML_BYTES) {
      return { ...base, htmlUnavailable: tooLarge(rawBytes) }
    }
    // Results docs live one level down and point at `../assets/shot.png` — the
    // same gallery the Assets tab lists — so resolve relative to their own
    // directory but keep containment at the evidence root, matching doc-set.ts.
    const html = useResults
      ? await inlineLocalAssets(resultsDir, raw, dir)
      : await inlineLocalAssets(dir, raw)
    const inlinedBytes = Buffer.byteLength(html, 'utf8')
    if (inlinedBytes > MAX_HTML_BYTES) {
      return { ...base, htmlUnavailable: tooLarge(inlinedBytes) }
    }
    return { ...base, html }
  } catch {
    return null
  }
}

/**
 * Metadata only, for the Feature list opener and the Evidence header (no HTML
 * payload). Null means "no pack" — see `evidencePackExists` for what counts.
 */
export async function readEvidenceMeta(repoPath: string): Promise<EvidenceMeta | null> {
  const shape = await readPackShape(repoPath)
  if (!evidencePackExists(shape)) return null

  const meta = await readDiskMeta(repoPath)
  return {
    title: meta?.title?.trim() || 'Evidence',
    updatedAt: await resolveUpdatedAt(evidenceIndexPath(repoPath), meta, shape),
    dir: evidenceDirForRepo(repoPath),
    checks: meta?.checks ?? [],
    medium: 'html',
    results: shape.results,
    assets: shape.assets,
    hasReport: shape.hasReport,
  }
}

/**
 * Remove a repo's loop evidence by deleting the on-disk directory.
 * Atomic enough for the UI (watcher + poll refresh).
 */
export async function clearEvidence(repoPath: string): Promise<void> {
  await rm(evidenceDirForRepo(repoPath), { recursive: true, force: true }).catch(() => {})
}
