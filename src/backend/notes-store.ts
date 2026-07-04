import { z } from 'zod'
import { loadConfig } from './config-store'
import { createHomeChannel } from './home-channel'

/**
 * The repo-notes channel: the human's freeform per-repo markdown scratchpad, keyed by
 * absolute repo path, in `~/.porcelain/notes.json` (same fixed home-dir rationale as
 * the review-set / comment / board / action channels — a plain `node` MCP process
 * can't resolve userData). ONE-WAY, app→agent: only the app writes (the human edits the
 * Notes card); the MCP server (src/mcp/notes-file.ts) only reads. That's why there's no
 * `review-watch` entry for it — the app is the SOLE writer, nothing pushes back.
 * Atomic (tmp + rename) + in-process-serialized writes. Notes lived in
 * userData/config.json until they moved here so the MCP could read them
 * (see migrateNotesFromConfig).
 */
export const notesSchema = z.record(z.string(), z.string())
export type Notes = z.infer<typeof notesSchema>

const channel = createHomeChannel({
  envVar: 'PORCELAIN_NOTES',
  fileName: 'notes.json',
  schema: notesSchema,
  empty: (): Notes => ({}),
})

// Must match src/mcp/notes-file.ts. PORCELAIN_NOTES redirects both sides for tests.
export const notesPath = channel.path

/** The human's notes for a repo ('' when none / file absent). */
export async function readNotes(repoPath: string): Promise<string> {
  return (await channel.readAll())[repoPath] ?? ''
}

/** Replace a repo's notes; an empty string drops the entry so the file stays tidy. */
export async function writeNotes(repoPath: string, notes: string): Promise<void> {
  await channel.mutate((all) => {
    if (notes === '') delete all[repoPath]
    else all[repoPath] = notes
  })
}

/**
 * One-time migration: notes used to live in userData/config.json
 * (`config.repos[*].notes`). Copy any non-empty legacy notes into notes.json so the
 * MCP — which can't resolve userData — can serve them. Idempotent: only fills a repo
 * whose notes.json entry is absent, so it no-ops once migrated and never clobbers a
 * newer in-app edit. Runs at startup, before any window reads notes.
 */
export async function migrateNotesFromConfig(): Promise<void> {
  const config = await loadConfig()
  const legacy = Object.entries(config.repos).filter(([, repo]) => repo.notes)
  if (legacy.length === 0) return
  await channel.mutate((all) => {
    for (const [repoPath, repo] of legacy) {
      if (all[repoPath] === undefined && repo.notes) all[repoPath] = repo.notes
    }
  })
}
