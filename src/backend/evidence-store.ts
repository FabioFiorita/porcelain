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
 * Evidence — **files on disk are the source of truth.**
 *
 *   ~/.porcelain/loop-evidence/<key>/
 *     index.html          — HTML body (required)
 *     meta.json           — title / checks
 *     + optional screenshots
 *
 * Agents write those files with normal Write tools (no CLI payload). The app
 * reads the directory, inlines relative images for the sandboxed HTML viewer, and
 * clears by deleting the directory. Legacy `evidence.json` (HTML embedded by the
 * older `evidence set`) is still read as a fallback. Excalidraw is **not** an
 * evidence medium (use Intent freeform canvas via `review set-canvas` instead).
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

export type EvidenceMedium = 'html'

export type Evidence = {
  title: string
  updatedAt: string
  /** Absolute directory (for "open in browser" / Reveal). */
  dir?: string
  /** Structured verification checks (empty when none were recorded). */
  checks: EvidenceCheck[]
  /** Always HTML for evidence (Excalidraw is Intent-only). */
  medium: EvidenceMedium
  /** Inlined for the sandboxed iframe. */
  html?: string
}

export type EvidenceMeta = {
  title: string
  updatedAt: string
  checks: EvidenceCheck[]
  dir?: string
  medium: EvidenceMedium
}

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

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function resolveUpdatedAt(
  bodyPath: string,
  meta: z.infer<typeof metaSchema> | null,
): Promise<string> {
  if (meta?.updatedAt) return meta.updatedAt
  try {
    return (await stat(bodyPath)).mtime.toISOString()
  } catch {
    return ''
  }
}

/**
 * Prefer on-disk index.html; else legacy evidence.json. Oversized / malformed
 * bodies are treated as absent (never thrown). A scene-only dir (old Excalidraw
 * evidence) is not treated as evidence — rewrite as HTML.
 */
export async function readEvidence(repoPath: string): Promise<Evidence | null> {
  const dir = evidenceDirForRepo(repoPath)
  const indexPath = evidenceIndexPath(repoPath)
  const meta = await readDiskMeta(repoPath)
  const checks = meta?.checks ?? []
  const title = meta?.title?.trim() || 'Evidence'

  if (await fileExists(indexPath)) {
    try {
      const raw = await readFile(indexPath, 'utf8')
      if (raw.length === 0) return null
      if (Buffer.byteLength(raw, 'utf8') > MAX_HTML_BYTES) return null
      const html = await inlineLocalAssets(dir, raw)
      if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) return null
      return {
        title,
        html,
        updatedAt: await resolveUpdatedAt(indexPath, meta),
        dir,
        checks,
        medium: 'html',
      }
    } catch {
      return null
    }
  }

  try {
    const all = evidencesSchema.parse(JSON.parse(await readFile(evidencePath(), 'utf8')))
    const evidence = all[repoPath]
    if (!evidence) return null
    if (Buffer.byteLength(evidence.html, 'utf8') > MAX_HTML_BYTES) return null
    return {
      title: evidence.title,
      html: evidence.html,
      updatedAt: evidence.updatedAt,
      checks: [],
      medium: 'html',
    }
  } catch {
    return null
  }
}

/** Metadata only, for the Feature list opener (no HTML payload). */
export async function readEvidenceMeta(repoPath: string): Promise<EvidenceMeta | null> {
  const indexPath = evidenceIndexPath(repoPath)
  const hasIndex = await fileExists(indexPath)

  if (hasIndex) {
    const meta = await readDiskMeta(repoPath)
    return {
      title: meta?.title?.trim() || 'Evidence',
      updatedAt: await resolveUpdatedAt(indexPath, meta),
      dir: evidenceDirForRepo(repoPath),
      checks: meta?.checks ?? [],
      medium: 'html',
    }
  }

  // Legacy JSON channel.
  try {
    const all = evidencesSchema.parse(JSON.parse(await readFile(evidencePath(), 'utf8')))
    const evidence = all[repoPath]
    if (!evidence) return null
    return {
      title: evidence.title,
      updatedAt: evidence.updatedAt,
      checks: [],
      medium: 'html',
    }
  } catch {
    return null
  }
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
