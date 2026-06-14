import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type ReviewSet, reviewSetsSchema } from './review-set'

/**
 * The agent channel: review sets the MCP server writes, keyed by absolute repo path.
 * Lives in `~/.porcelain/` — the user's home, NOT the work repo (Porcelain never
 * writes into work repos) and NOT `userData` (a plain `node` MCP process can't
 * resolve Electron's userData path, so both sides agree on this fixed location).
 * The app only ever READS this file; the standalone MCP server is the sole writer.
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
