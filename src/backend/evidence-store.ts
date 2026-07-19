import { readFile, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import {
  type EvidenceCheck,
  MAX_CHECK_DETAIL,
  MAX_CHECK_LABEL,
  MAX_CHECKS,
} from '../shared/evidence-check'
import { inlineLocalAssets } from './evidence-assets'
import { evidenceDirForRepo, evidenceIndexPath, evidenceMetaPath } from './evidence-paths'
import { createHomeChannel } from './home-channel'

// Structured checks live in the node-free `../shared/evidence-check` leaf so the
// renderer can import the shape + `evidenceOverallStatus` without pulling this
// module's fs graph; re-exported here so backend/test callers use one entry.
export {
  type EvidenceCheck,
  type EvidenceCheckStatus,
  evidenceOverallStatus,
} from '../shared/evidence-check'

/**
 * Loop evidence — **files on disk are the source of truth.**
 *
 *   ~/.porcelain/loop-evidence/<key>/index.html  (+ optional screenshots, meta.json)
 *
 * Agents write those files with normal Write tools (no CLI payload). The app
 * reads the directory, inlines relative images for the sandboxed viewer, and
 * clears by deleting the directory. Legacy `evidence.json` (HTML embedded by the
 * older `evidence set`) is still read as a fallback.
 *
 * See `evidence-paths.ts` for layout; `src/cli/evidence-file.ts` for the CLI
 * prepare/write side.
 */

/**
 * Read-side cap on the inlined HTML. Higher than the CLI `set` payload cap
 * (`MAX_HTML_BYTES` in src/cli/evidence-file.ts, 1.5 MB) on purpose: agents write
 * multi-screenshot evidence as sibling files and this module inlines them as
 * data: URIs, so the read-side document needs headroom the write-side payload
 * doesn't. Keep the folder itself under a few MB (shrink screenshots).
 */
export const MAX_HTML_BYTES = 4_194_304

const evidenceSchema = z.object({
  title: z.string(),
  html: z.string(),
  updatedAt: z.string(),
})
const evidencesSchema = z.record(z.string(), evidenceSchema)

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

export type Evidence = z.infer<typeof evidenceSchema> & {
  /** Absolute directory holding index.html (for "open in browser" / Reveal). */
  dir?: string
  /** Structured verification checks (empty when none were recorded). */
  checks: EvidenceCheck[]
}
export type EvidenceMeta = Pick<Evidence, 'title' | 'updatedAt' | 'checks'> & { dir?: string }

/** Legacy channel (HTML embedded in JSON) — fallback + clear of old entries. */
export function evidencePath(): string {
  return process.env.PORCELAIN_EVIDENCE ?? join(homedir(), '.porcelain', 'evidence.json')
}

// Re-export path helpers so callers (review-watch, e2e) use one place.
export { evidenceDirForRepo, evidenceIndexPath, loopEvidenceRoot } from './evidence-paths'

const channel = createHomeChannel({
  path: evidencePath,
  schema: evidencesSchema,
  empty: (): z.infer<typeof evidencesSchema> => ({}),
})

async function readDiskMeta(repoPath: string): Promise<z.infer<typeof metaSchema> | null> {
  try {
    return metaSchema.parse(JSON.parse(await readFile(evidenceMetaPath(repoPath), 'utf8')))
  } catch {
    return null
  }
}

/**
 * Prefer on-disk index.html; fall back to legacy evidence.json. Oversized HTML is
 * treated as absent (never thrown) so one bad write can't break the viewer.
 */
export async function readEvidence(repoPath: string): Promise<Evidence | null> {
  const dir = evidenceDirForRepo(repoPath)
  const indexPath = evidenceIndexPath(repoPath)
  try {
    const raw = await readFile(indexPath, 'utf8')
    if (raw.length === 0) return null
    if (Buffer.byteLength(raw, 'utf8') > MAX_HTML_BYTES) return null
    const html = await inlineLocalAssets(dir, raw)
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) return null
    const meta = await readDiskMeta(repoPath)
    let updatedAt = meta?.updatedAt ?? ''
    if (!updatedAt) {
      try {
        updatedAt = (await stat(indexPath)).mtime.toISOString()
      } catch {
        updatedAt = ''
      }
    }
    return {
      title: meta?.title?.trim() || 'Loop evidence',
      html,
      updatedAt,
      dir,
      checks: meta?.checks ?? [],
    }
  } catch {
    // no index.html — try legacy json
  }

  try {
    const all = evidencesSchema.parse(JSON.parse(await readFile(evidencePath(), 'utf8')))
    const evidence = all[repoPath]
    if (!evidence) return null
    if (Buffer.byteLength(evidence.html, 'utf8') > MAX_HTML_BYTES) return null
    return { ...evidence, checks: [] }
  } catch {
    return null
  }
}

/** Metadata only (title + updatedAt + dir), for the Feature list opener. */
export async function readEvidenceMeta(repoPath: string): Promise<EvidenceMeta | null> {
  const indexPath = evidenceIndexPath(repoPath)
  try {
    await stat(indexPath)
    const meta = await readDiskMeta(repoPath)
    let updatedAt = meta?.updatedAt ?? ''
    if (!updatedAt) {
      try {
        updatedAt = (await stat(indexPath)).mtime.toISOString()
      } catch {
        updatedAt = ''
      }
    }
    return {
      title: meta?.title?.trim() || 'Loop evidence',
      updatedAt,
      dir: evidenceDirForRepo(repoPath),
      checks: meta?.checks ?? [],
    }
  } catch {
    // fall through to legacy
  }

  const evidence = await readEvidence(repoPath)
  return evidence
    ? {
        title: evidence.title,
        updatedAt: evidence.updatedAt,
        dir: evidence.dir,
        checks: evidence.checks,
      }
    : null
}

/**
 * Remove a repo's loop evidence: delete the on-disk directory and any legacy
 * evidence.json entry. Atomic enough for the UI (watcher + poll refresh).
 */
export async function clearEvidence(repoPath: string): Promise<void> {
  await rm(evidenceDirForRepo(repoPath), { recursive: true, force: true }).catch(() => {})
  await channel.mutate((all) => {
    if (repoPath in all) delete all[repoPath]
  })
}
