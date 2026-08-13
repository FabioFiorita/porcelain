import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  type EvidenceCheck,
  MAX_CHECK_DETAIL,
  MAX_CHECK_LABEL,
  MAX_CHECKS,
} from '@shared/evidence-check'
import { projectEvidenceResultsDir } from '@shared/project-porcelain'
import { z } from 'zod'
import { inlineLocalAssets } from '../fs/evidence-assets'
import { evidenceDirForRepo, evidenceIndexPath, evidenceMetaPath } from '../fs/evidence-paths'

// Structured checks live in the node-free `@shared/evidence-check` leaf so the
// renderer can import the shape + `evidenceOverallStatus` without pulling this
// module's fs graph; re-exported here so backend/test callers use one entry.
export { type EvidenceCheck, evidenceOverallStatus } from '@shared/evidence-check'

/**
 * What is LEFT of the pre-sub-tab evidence store: the single-page body behind
 * `loopEvidenceHtml`, and the read cap two callers share. The pack itself — its
 * meta, its `results/` documents, its `assets/` gallery, its presence, its
 * freshness, and its clear — is owned by
 * `features/review/fs-review-evidence-store.ts`.
 *
 * Files on disk stay the source of truth: agents write with normal Write tools and
 * the app inlines relative images for the sandboxed viewer. REV-009 deletes this
 * module with `loopEvidenceHtml`. See `evidence-paths.ts`.
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

type EvidenceBase = {
  title: string
  updatedAt: string
  /** Absolute directory (for "open in browser" / Reveal). */
  dir?: string
  /** Structured verification checks (empty when none were recorded). */
  checks: EvidenceCheck[]
  /** Always HTML for evidence. */
  medium: EvidenceMedium
}

/**
 * Exactly one body outcome per read, matching the public contract's two members:
 * the inlined HTML for the sandboxed iframe, or the reason it cannot be served
 * (title/checks still valid) — never collapsed into `null`, which looks "cleared".
 */
export type Evidence =
  | (EvidenceBase & { html: string; htmlUnavailable?: never })
  | (EvidenceBase & { html?: never; htmlUnavailable: EvidenceHtmlUnavailable })

// Re-export path helpers so callers (review-watch, e2e) use one place.
export { evidenceDirForRepo } from '../fs/evidence-paths'

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

/**
 * Effective stamp for the legacy report: the later of meta.updatedAt and the body's
 * own mtime. An in-place edit (a `sed`) must invalidate even when `evidence check`
 * never re-bumped meta.
 */
async function resolveUpdatedAt(
  bodyPath: string,
  meta: z.infer<typeof metaSchema> | null,
): Promise<string> {
  let latest = meta?.updatedAt?.trim() || ''
  try {
    const at = (await stat(bodyPath)).mtime.toISOString()
    if (at > latest) latest = at
  } catch {
    // missing body
  }
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
