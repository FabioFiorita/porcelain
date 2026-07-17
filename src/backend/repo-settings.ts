import { z } from 'zod'
import { type Action, actionSchema, readActions, writeActions } from './actions-store'
import { type BoardCard, boardCardSchema, readCards, writeCards } from './board-store'
import {
  type ReviewComment,
  readComments,
  reviewCommentSchema,
  writeComments,
} from './comment-store'
import type { Layer } from './flow'
import { readLayers, writeLayers } from './layers-store'
import { readNotes, writeNotes } from './notes-store'

/**
 * Snapshot of the per-repo companion data agents (or scripts) carry from one
 * environment/path to another (Mac → remote daemon, or remapping after a clone).
 * Channel files are keyed by absolute path on the *daemon host* — never silent.
 * Agents use the `sync-environments` companion skill (MCP list/create + SSH/path
 * remap); the Settings UI no longer offers a one-click seed.
 *
 * Included: actions (saved commands), notes, board, flow layers, review comments.
 * Deliberately NOT included: reviewed marks, feature-view snapshot, artifacts /
 * loop evidence, review sets (dynamic feature view), agent chat (ephemeral relay).
 * Hidden/pinned folders live in daemon config.json — see the skill, not this snapshot.
 */
export const repoSettingsSchema = z.object({
  actions: z.array(actionSchema).optional(),
  notes: z.string().optional(),
  board: z.array(boardCardSchema).optional(),
  layers: z.array(z.object({ label: z.string(), pattern: z.string() })).optional(),
  comments: z.array(reviewCommentSchema).optional(),
})
export type RepoSettings = z.infer<typeof repoSettingsSchema>

export interface ImportRepoSettingsResult {
  /** Channel names that were written (empty when the snapshot had nothing). */
  imported: Array<'actions' | 'notes' | 'board' | 'layers' | 'comments'>
}

/** Read the current channel snapshot for a repo on this daemon host. */
export async function exportRepoSettings(repoPath: string): Promise<RepoSettings> {
  const [actions, notes, board, layers, comments] = await Promise.all([
    readActions(repoPath),
    readNotes(repoPath),
    readCards(repoPath),
    readLayers(repoPath),
    readComments(repoPath),
  ])
  const settings: RepoSettings = {}
  if (actions.length > 0) settings.actions = actions
  if (notes !== '') settings.notes = notes
  if (board.length > 0) settings.board = board
  if (layers !== null && layers.length > 0) settings.layers = layers
  if (comments.length > 0) settings.comments = comments
  return settings
}

/**
 * Write a settings snapshot onto `repoPath` on this daemon host. Each present
 * channel **replaces** the target entry (no silent merge — the human asked to
 * seed). Absent channels in the snapshot are left alone on the target.
 */
export async function importRepoSettings(
  repoPath: string,
  settings: RepoSettings,
): Promise<ImportRepoSettingsResult> {
  const imported: ImportRepoSettingsResult['imported'] = []
  const parsed = repoSettingsSchema.parse(settings)

  if (parsed.actions !== undefined) {
    await writeActions(repoPath, parsed.actions as Action[])
    imported.push('actions')
  }
  if (parsed.notes !== undefined) {
    await writeNotes(repoPath, parsed.notes)
    imported.push('notes')
  }
  if (parsed.board !== undefined) {
    await writeCards(repoPath, parsed.board as BoardCard[])
    imported.push('board')
  }
  if (parsed.layers !== undefined) {
    await writeLayers(repoPath, parsed.layers as Layer[])
    imported.push('layers')
  }
  if (parsed.comments !== undefined) {
    await writeComments(repoPath, parsed.comments as ReviewComment[])
    imported.push('comments')
  }

  return { imported }
}

/**
 * Copy settings from one absolute path key to another on the same daemon host
 * (e.g. remapping `/Users/…/Code/foo` → `/home/…/code/foo` after a clone).
 */
export async function copyRepoSettings(
  fromPath: string,
  toPath: string,
): Promise<ImportRepoSettingsResult> {
  if (fromPath === toPath) {
    return { imported: [] }
  }
  const settings = await exportRepoSettings(fromPath)
  return importRepoSettings(toPath, settings)
}
