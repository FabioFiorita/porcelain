import { z } from 'zod'
import { loadConfig } from './config-store'
import { createHomeChannel } from './home-channel'

/**
 * The reviewed-marks channel: the repo-relative file paths the human has checked off
 * as reviewed in Porcelain (the per-file marks in the Changes / Feature lists), keyed
 * by absolute repo path, in `~/.porcelain/reviewed.json` (same fixed home-dir rationale
 * as the review-set / comment / board / notes channels — a plain `node` MCP process
 * can't resolve userData). ONE-WAY, app→agent: only the app writes (the human marks
 * files reviewed); the MCP server (src/mcp/reviewed-file.ts) only reads them, so the
 * agent knows what the human has already vetted. Like notes, the app is the SOLE
 * writer — there is no review-watch entry and no write tool, nothing pushes back.
 * Atomic (tmp + rename) + in-process-serialized writes.
 *
 * The marks describe the current working tree; `gitCommit` clears the committed files'
 * marks (a later re-edit starts unreviewed). Marks lived in userData/config.json
 * (`config.repos[*].reviewedPaths`) until they moved here so the MCP could read them
 * (see migrateReviewedFromConfig).
 */
export const reviewedSchema = z.record(z.string(), z.array(z.string()))
export type Reviewed = z.infer<typeof reviewedSchema>

const channel = createHomeChannel({
  envVar: 'PORCELAIN_REVIEWED',
  fileName: 'reviewed.json',
  schema: reviewedSchema,
  empty: (): Reviewed => ({}),
})

// Must match src/mcp/reviewed-file.ts. PORCELAIN_REVIEWED redirects both sides for tests.
export const reviewedPath = channel.path

// Drop an emptied entry so the file stays tidy (matches notes/layers).
function setPaths(all: Reviewed, repoPath: string, paths: string[]): void {
  if (paths.length === 0) delete all[repoPath]
  else all[repoPath] = paths
}

/** The repo-relative paths the human has marked reviewed ([] when none / file absent). */
export async function readReviewedPaths(repoPath: string): Promise<string[]> {
  return (await channel.readAll())[repoPath] ?? []
}

/** Mark a path reviewed (idempotent — a path already present is left as-is). */
export async function markReviewed(repoPath: string, path: string): Promise<void> {
  await channel.mutate((all) => {
    const current = all[repoPath] ?? []
    if (current.includes(path)) return
    setPaths(all, repoPath, [...current, path])
  })
}

/** Unmark a path (no-op when it wasn't reviewed). */
export async function unmarkReviewed(repoPath: string, path: string): Promise<void> {
  await channel.mutate((all) => {
    const current = all[repoPath]
    if (!current) return
    setPaths(
      all,
      repoPath,
      current.filter((p) => p !== path),
    )
  })
}

/** Drop many marks at once (the files just committed — their marks no longer apply). */
export async function clearReviewedPaths(repoPath: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await channel.mutate((all) => {
    const current = all[repoPath]
    if (!current) return
    const removed = new Set(paths)
    setPaths(
      all,
      repoPath,
      current.filter((p) => !removed.has(p)),
    )
  })
}

/**
 * Replace a repo's reviewed marks wholesale — the header "mark all / unmark all" toggle.
 * An empty list clears the repo's entry (unmark all); duplicates are collapsed.
 */
export async function setReviewedPaths(repoPath: string, paths: string[]): Promise<void> {
  await channel.mutate((all) => {
    setPaths(all, repoPath, [...new Set(paths)])
  })
}

/**
 * One-time migration: reviewed marks used to live in userData/config.json
 * (`config.repos[*].reviewedPaths`). Copy any non-empty legacy marks into reviewed.json
 * so the MCP — which can't resolve userData — can serve them. Idempotent: only fills a
 * repo whose reviewed.json entry is absent, so it no-ops once migrated and never
 * clobbers a newer in-app mark. Runs at startup, before any window reads the marks.
 */
export async function migrateReviewedFromConfig(): Promise<void> {
  const config = await loadConfig()
  const legacy = Object.entries(config.repos).filter(([, repo]) => repo.reviewedPaths?.length)
  if (legacy.length === 0) return
  await channel.mutate((all) => {
    for (const [repoPath, repo] of legacy) {
      if (all[repoPath] === undefined && repo.reviewedPaths?.length) {
        all[repoPath] = repo.reviewedPaths
      }
    }
  })
}
