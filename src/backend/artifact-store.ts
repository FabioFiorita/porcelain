import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { createHomeChannel } from './home-channel'

/**
 * The feature-artifact channel: a self-contained HTML document the porcelain CLI writes
 * to explain a feature, keyed by absolute repo path, in `~/.porcelain/artifacts.json`
 * (same fixed home-dir location + rationale as the review-set channel — the user's
 * home, NOT a work repo, and NOT userData which a plain-`node` CLI process can't
 * resolve). The porcelain CLI (src/cli/artifact-file.ts) AUTHORS artifacts; the app READS
 * them — and makes exactly one write, `clearArtifact` (user-initiated), to delete a
 * repo's entry. No network surface either way (a local CLI, local file).
 *
 * The HTML is agent-authored ACTIVE content, so the renderer shows it ONLY inside a
 * fully sandboxed iframe (`sandbox=""`, `srcdoc`, no allow-scripts/allow-same-origin).
 * The app still re-validates + size-caps this file with zod on EVERY read because an
 * external process owns it (see the audit skill).
 */

/** Keep in sync with MAX_HTML_BYTES in src/cli/artifact-file.ts (the sole writer). */
export const MAX_HTML_BYTES = 1_572_864

const artifactSchema = z.object({
  title: z.string(),
  html: z.string(),
  updatedAt: z.string(),
})
const artifactsSchema = z.record(z.string(), artifactSchema)

export type Artifact = z.infer<typeof artifactSchema>
export type ArtifactMeta = Pick<Artifact, 'title' | 'updatedAt'>

export function artifactsPath(): string {
  // Must match src/cli/artifact-file.ts. PORCELAIN_ARTIFACTS lets dev/tests redirect
  // both sides to the same throwaway path.
  return process.env.PORCELAIN_ARTIFACTS ?? join(homedir(), '.porcelain', 'artifacts.json')
}

// The read path stays custom below (per-entry MAX_HTML_BYTES drop); the channel
// exists only for the app's one write — the user-initiated clear.
const channel = createHomeChannel({
  path: artifactsPath,
  schema: artifactsSchema,
  empty: (): z.infer<typeof artifactsSchema> => ({}),
})

/**
 * The agent-authored artifact for a repo, or null if none / the file is absent,
 * corrupt, or the html is over the size cap. An oversized entry is treated as absent
 * (never thrown) so one bad agent write can't break the viewer.
 */
export async function readArtifact(repoPath: string): Promise<Artifact | null> {
  try {
    const all = artifactsSchema.parse(JSON.parse(await readFile(artifactsPath(), 'utf8')))
    const artifact = all[repoPath]
    if (!artifact) return null
    if (Buffer.byteLength(artifact.html, 'utf8') > MAX_HTML_BYTES) return null
    return artifact
  } catch {
    // absent, unparseable, or schema-invalid (an external process owns this file) —
    // treat as "no artifact"
    return null
  }
}

/** Metadata only (title + updatedAt), so the Feature list can cheaply show/hide the
 *  artifact opener without shuttling the whole HTML document over IPC on every poll. */
export async function readArtifactMeta(repoPath: string): Promise<ArtifactMeta | null> {
  const artifact = await readArtifact(repoPath)
  return artifact ? { title: artifact.title, updatedAt: artifact.updatedAt } : null
}

/**
 * Remove a repo's artifact. Atomic (tmp + rename) so a concurrent CLI write can't
 * corrupt the shared file; a no-op if the file is absent/corrupt or the repo has no
 * artifact. The watcher (`review-watch.ts`) sees the change and refreshes the open
 * view like any CLI write.
 */
export async function clearArtifact(repoPath: string): Promise<void> {
  await channel.mutate((all) => {
    if (repoPath in all) delete all[repoPath]
  })
}
