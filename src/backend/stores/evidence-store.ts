import { readFile, rm, stat } from 'node:fs/promises'
import { z } from 'zod'
import {
  type EvidenceCheck,
  MAX_CHECK_DETAIL,
  MAX_CHECK_LABEL,
  MAX_CHECKS,
} from '../shared/evidence-check'
import { inlineLocalAssets } from './evidence-assets'
import { evidenceDirForRepo, evidenceIndexPath, evidenceMetaPath } from './evidence-paths'

// Structured checks live in the node-free `../shared/evidence-check` leaf so the
// renderer can import the shape + `evidenceOverallStatus` without pulling this
// module's fs graph; re-exported here so backend/test callers use one entry.
export { type EvidenceCheck, evidenceOverallStatus } from '../shared/evidence-check'

/**
 * Evidence — **files on disk are the source of truth**:
 * `~/.porcelain/loop-evidence/<key>/` holds `index.html` (required), `meta.json`
 * (title / checks) and optional screenshots. Agents write them with normal Write
 * tools; the app inlines relative images for the sandboxed viewer and clears by
 * deleting the directory. Excalidraw is NOT an evidence medium — the Intent
 * freeform canvas (`review set-canvas`) is. See `evidence-paths.ts`.
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
  /** Always HTML for evidence (Excalidraw is Intent-only). */
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
  medium: EvidenceMedium
}

// Re-export path helpers so callers (review-watch, e2e) use one place.
export { evidenceDirForRepo, loopEvidenceRoot } from './evidence-paths'

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
 * Effective stamp for the evidence pack: the later of meta.updatedAt and
 * index.html mtime. In-place edits (sed, agent Write of screenshots + HTML)
 * must invalidate even when `evidence check` never re-bumped meta.
 */
async function resolveUpdatedAt(
  bodyPath: string,
  meta: z.infer<typeof metaSchema> | null,
): Promise<string> {
  let bodyMtime = ''
  try {
    bodyMtime = (await stat(bodyPath)).mtime.toISOString()
  } catch {
    // missing body
  }
  const metaAt = meta?.updatedAt?.trim() || ''
  if (metaAt && bodyMtime) return metaAt > bodyMtime ? metaAt : bodyMtime
  return metaAt || bodyMtime || ''
}

function tooLarge(bytes: number): EvidenceHtmlUnavailable {
  return { reason: 'too-large', bytes, maxBytes: MAX_HTML_BYTES }
}

/**
 * Prefer on-disk index.html. Oversized bodies keep title/checks and surface
 * `htmlUnavailable` (never silent null — that looked like "cleared"). Malformed
 * / empty index → null. A scene-only dir (old Excalidraw evidence) is not treated
 * as evidence — rewrite as HTML.
 */
export async function readEvidence(repoPath: string): Promise<Evidence | null> {
  const dir = evidenceDirForRepo(repoPath)
  const indexPath = evidenceIndexPath(repoPath)
  if (!(await fileExists(indexPath))) return null

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
    const html = await inlineLocalAssets(dir, raw)
    const inlinedBytes = Buffer.byteLength(html, 'utf8')
    if (inlinedBytes > MAX_HTML_BYTES) {
      return { ...base, htmlUnavailable: tooLarge(inlinedBytes) }
    }
    return { ...base, html }
  } catch {
    return null
  }
}

/** Metadata only, for the Feature list opener (no HTML payload). */
export async function readEvidenceMeta(repoPath: string): Promise<EvidenceMeta | null> {
  const indexPath = evidenceIndexPath(repoPath)
  if (!(await fileExists(indexPath))) return null

  const meta = await readDiskMeta(repoPath)
  return {
    title: meta?.title?.trim() || 'Evidence',
    updatedAt: await resolveUpdatedAt(indexPath, meta),
    dir: evidenceDirForRepo(repoPath),
    checks: meta?.checks ?? [],
    medium: 'html',
  }
}

/**
 * Remove a repo's loop evidence by deleting the on-disk directory.
 * Atomic enough for the UI (watcher + poll refresh).
 */
export async function clearEvidence(repoPath: string): Promise<void> {
  await rm(evidenceDirForRepo(repoPath), { recursive: true, force: true }).catch(() => {})
}
