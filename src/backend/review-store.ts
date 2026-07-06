import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { createHomeChannel } from './home-channel'
import { type ReviewSet, type ReviewSets, reviewSetsSchema } from './review-set'

/**
 * True when `entryPath` (a path from the external, MCP-authored review-set file)
 * stays inside `repoPath`. Rejects absolute paths and `..`-escapes — the file is
 * owned by an untrusted external process, so its paths must be repo-contained
 * before they reach `readFile(join(repoPath, entryPath))`.
 */
export function isRepoContained(repoPath: string, entryPath: string): boolean {
  if (isAbsolute(entryPath)) return false
  const rel = relative(repoPath, resolve(repoPath, entryPath))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * The agent channel: review sets the MCP server writes, keyed by absolute repo path.
 * Lives in `~/.porcelain/` — the user's home, NOT the work repo (Porcelain never
 * writes into work repos) and NOT `userData` (a plain `node` MCP process can't
 * resolve Electron's userData path, so both sides agree on this fixed location).
 * The MCP server AUTHORS the sets; the app READS them — and makes exactly one write,
 * `clearReviewSet` (user-initiated from the Feature tab's Clear button), to delete a
 * repo's entry. No network surface either way (stdio MCP, local file).
 */
export function reviewSetsPath(): string {
  // Must match src/mcp/review-file.ts (the sole writer). PORCELAIN_REVIEW_SETS lets
  // dev/tests redirect both sides to the same throwaway path.
  return process.env.PORCELAIN_REVIEW_SETS ?? join(homedir(), '.porcelain', 'review-sets.json')
}

// The read path stays custom below (per-entry repo-containment filter); the channel
// exists only for the app's one write — the user-initiated clear.
const channel = createHomeChannel({
  path: reviewSetsPath,
  schema: reviewSetsSchema,
  empty: (): ReviewSets => ({}),
})

/** The agent-fed review set for a repo, or null if none / the file is absent or corrupt. */
export async function readReviewSet(repoPath: string): Promise<ReviewSet | null> {
  try {
    const raw = await readFile(reviewSetsPath(), 'utf8')
    const all = reviewSetsSchema.parse(JSON.parse(raw))
    const set = all[repoPath]
    if (!set) return null
    return { ...set, files: set.files.filter((file) => isRepoContained(repoPath, file.path)) }
  } catch {
    // absent, unparseable, or schema-invalid (an external process owns this file) —
    // treat as "no agent set" and fall back to the static baseline
    return null
  }
}

/**
 * Remove a repo's review set, reverting its feature view to the static baseline.
 * Atomic (tmp + rename) so a concurrent MCP write can't corrupt the shared file;
 * a no-op if the file is absent/corrupt or the repo has no set. The watcher
 * (`review-watch.ts`) sees the change and refreshes the open view like any MCP write.
 */
export async function clearReviewSet(repoPath: string): Promise<void> {
  await channel.mutate((all) => {
    if (repoPath in all) delete all[repoPath]
  })
}
