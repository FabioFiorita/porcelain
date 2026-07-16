import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { createHomeChannel } from './home-channel'

/**
 * The loop-evidence channel: a self-contained HTML document the MCP server writes
 * as *proof the agent closed the loop* (browser/simulator validation, screenshots,
 * pass/fail checklist), keyed by absolute repo path, in `~/.porcelain/evidence.json`
 * (same fixed home-dir location + rationale as the review-set / artifact channels —
 * the user's home, NOT a work repo, and NOT userData which a plain-`node` MCP process
 * can't resolve). The MCP server (src/mcp/evidence-file.ts) AUTHORS evidence; the app
 * READS them — and makes exactly one write, `clearEvidence` (user-initiated), to delete
 * a repo's entry. No network surface either way (stdio MCP, local file).
 *
 * Complements the feature artifact: that is the narrative explainer of *how it works*;
 * this is ephemeral proof that *it works* — the human clears it once reviewed (e.g.
 * before commit/push). Same sandbox rules as artifacts.
 */

/** Keep in sync with MAX_HTML_BYTES in src/mcp/evidence-file.ts (the sole writer). */
export const MAX_HTML_BYTES = 1_572_864

const evidenceSchema = z.object({
  title: z.string(),
  html: z.string(),
  updatedAt: z.string(),
})
const evidencesSchema = z.record(z.string(), evidenceSchema)

export type Evidence = z.infer<typeof evidenceSchema>
export type EvidenceMeta = Pick<Evidence, 'title' | 'updatedAt'>

export function evidencePath(): string {
  // Must match src/mcp/evidence-file.ts. PORCELAIN_EVIDENCE lets dev/tests redirect
  // both sides to the same throwaway path.
  return process.env.PORCELAIN_EVIDENCE ?? join(homedir(), '.porcelain', 'evidence.json')
}

// The read path stays custom below (per-entry MAX_HTML_BYTES drop); the channel
// exists only for the app's one write — the user-initiated clear.
const channel = createHomeChannel({
  path: evidencePath,
  schema: evidencesSchema,
  empty: (): z.infer<typeof evidencesSchema> => ({}),
})

/**
 * The agent-authored loop evidence for a repo, or null if none / the file is absent,
 * corrupt, or the html is over the size cap. An oversized entry is treated as absent
 * (never thrown) so one bad agent write can't break the viewer.
 */
export async function readEvidence(repoPath: string): Promise<Evidence | null> {
  try {
    const all = evidencesSchema.parse(JSON.parse(await readFile(evidencePath(), 'utf8')))
    const evidence = all[repoPath]
    if (!evidence) return null
    if (Buffer.byteLength(evidence.html, 'utf8') > MAX_HTML_BYTES) return null
    return evidence
  } catch {
    // absent, unparseable, or schema-invalid (an external process owns this file) —
    // treat as "no evidence"
    return null
  }
}

/** Metadata only (title + updatedAt), so the Feature list can cheaply show/hide the
 *  evidence opener without shuttling the whole HTML document over IPC on every poll. */
export async function readEvidenceMeta(repoPath: string): Promise<EvidenceMeta | null> {
  const evidence = await readEvidence(repoPath)
  return evidence ? { title: evidence.title, updatedAt: evidence.updatedAt } : null
}

/**
 * Remove a repo's loop evidence. Atomic (tmp + rename) so a concurrent MCP write can't
 * corrupt the shared file; a no-op if the file is absent/corrupt or the repo has no
 * evidence. The watcher (`review-watch.ts`) sees the change and refreshes the open
 * view like any MCP write.
 */
export async function clearEvidence(repoPath: string): Promise<void> {
  await channel.mutate((all) => {
    if (repoPath in all) delete all[repoPath]
  })
}
