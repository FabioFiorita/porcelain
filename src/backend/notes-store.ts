import { z } from 'zod'
import { createHomeChannel } from './home-channel'

/**
 * The repo-notes channel: the human's freeform per-repo markdown scratchpad, keyed by
 * absolute repo path, in `~/.porcelain/notes.json` (same fixed home-dir rationale as
 * the review-set / comment / board / action channels — a plain `node` CLI process
 * can't resolve userData). ONE-WAY, app→agent: only the app writes (the human edits the
 * Notes card); the porcelain CLI (src/cli/notes-file.ts) only reads. That's why there's no
 * `review-watch` entry for it — the app is the SOLE writer, nothing pushes back.
 * Atomic (tmp + rename) + in-process-serialized writes.
 */
export const notesSchema = z.record(z.string(), z.string())
export type Notes = z.infer<typeof notesSchema>

const channel = createHomeChannel({
  envVar: 'PORCELAIN_NOTES',
  fileName: 'notes.json',
  schema: notesSchema,
  empty: (): Notes => ({}),
})

// Must match src/cli/notes-file.ts. PORCELAIN_NOTES redirects both sides for tests.
export const notesPath: () => string = channel.path

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
