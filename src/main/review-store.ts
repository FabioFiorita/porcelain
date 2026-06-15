import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { type ReviewSet, type ReviewSets, reviewSetsSchema } from './review-set'

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

/** The agent-fed review set for a repo, or null if none / the file is absent or corrupt. */
export async function readReviewSet(repoPath: string): Promise<ReviewSet | null> {
  try {
    const raw = await readFile(reviewSetsPath(), 'utf8')
    const all = reviewSetsSchema.parse(JSON.parse(raw))
    return all[repoPath] ?? null
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
  let all: ReviewSets
  try {
    all = reviewSetsSchema.parse(JSON.parse(await readFile(reviewSetsPath(), 'utf8')))
  } catch {
    return
  }
  if (!(repoPath in all)) return
  delete all[repoPath]
  const path = reviewSetsPath()
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(all, null, 2))
  await rename(tmp, path)
}
