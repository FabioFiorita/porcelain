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
import { isLinkedWorktree, primaryCheckoutPath } from './linked-worktree'
import { readNotes, writeNotes } from './notes-store'
import { hidePath, pinPath, type RepoScope, readRepoScope } from './scope-store'

/**
 * Snapshot of the per-repo companion data agents (or scripts) carry from one
 * environment/path to another (Mac → remote daemon, or remapping after a clone).
 * Channel files are keyed by absolute path on the *daemon host* — never silent.
 * Agents use the porcelain-companion skill's sync-environments reference (porcelain CLI list/create + SSH/path
 * remap); the Settings UI no longer offers a one-click seed.
 *
 * Included: actions, notes, board, flow layers, review comments, monorepo scope (hide/pin).
 * Deliberately NOT included: reviewed marks, feature-view snapshot, loop evidence,
 * review sets (dynamic Review).
 */
export const repoSettingsSchema = z.object({
  actions: z.array(actionSchema).optional(),
  notes: z.string().optional(),
  board: z.array(boardCardSchema).optional(),
  layers: z.array(z.object({ label: z.string(), pattern: z.string() })).optional(),
  comments: z.array(reviewCommentSchema).optional(),
  scope: z
    .object({
      hiddenPaths: z.array(z.string()).default([]),
      pinnedPaths: z.array(z.string()).default([]),
    })
    .optional(),
})
export type RepoSettings = z.infer<typeof repoSettingsSchema>

export interface ImportRepoSettingsResult {
  /** Channel names that were written (empty when the snapshot had nothing). */
  imported: Array<'actions' | 'notes' | 'board' | 'layers' | 'comments' | 'scope'>
}

/** Read the current channel snapshot for a repo on this daemon host. */
export async function exportRepoSettings(repoPath: string): Promise<RepoSettings> {
  const [actions, notes, board, layers, comments, scope] = await Promise.all([
    readActions(repoPath),
    readNotes(repoPath),
    readCards(repoPath),
    readLayers(repoPath),
    readComments(repoPath),
    readRepoScope(repoPath),
  ])
  const settings: RepoSettings = {}
  if (actions.length > 0) settings.actions = actions
  if (notes !== '') settings.notes = notes
  if (board.length > 0) settings.board = board
  if (layers !== null && layers.length > 0) settings.layers = layers
  if (comments.length > 0) settings.comments = comments
  if (scope.hiddenPaths.length > 0 || scope.pinnedPaths.length > 0) {
    settings.scope = scope
  }
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
  if (parsed.scope !== undefined) {
    const scope = parsed.scope as RepoScope
    // Apply each path (idempotent hide/pin). Callers remapping hosts should rewrite
    // absolute prefixes before import (copyRepoSettings does that on one daemon).
    for (const p of scope.hiddenPaths) await hidePath(repoPath, p)
    for (const p of scope.pinnedPaths) await pinPath(repoPath, p)
    imported.push('scope')
  }

  return { imported }
}

function remapUnderRoot(path: string, fromRoot: string, toRoot: string): string {
  if (path === fromRoot) return toRoot
  if (path.startsWith(`${fromRoot}/`)) return `${toRoot}${path.slice(fromRoot.length)}`
  return path
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
  if (settings.scope !== undefined) {
    settings.scope = {
      hiddenPaths: settings.scope.hiddenPaths.map((p) => remapUnderRoot(p, fromPath, toPath)),
      pinnedPaths: settings.scope.pinnedPaths.map((p) => remapUnderRoot(p, fromPath, toPath)),
    }
  }
  return importRepoSettings(toPath, settings)
}

/**
 * Copy settings onto a checkout that has NONE of its own, for the automatic paths (a
 * new worktree, or opening one that predates this seeding). Three properties the
 * explicit `copyRepoSettings` deliberately lacks: an existing entry is never
 * overwritten, a same-path or missing source is a no-op, and it never throws —
 * seeding is a courtesy, and the create/open it hangs off must not fail because a
 * channel file was unreadable.
 */
export async function seedRepoSettings(
  fromPath: string,
  toPath: string,
): Promise<ImportRepoSettingsResult> {
  try {
    if (fromPath === toPath) return { imported: [] }
    const existing = await exportRepoSettings(toPath)
    if (Object.keys(existing).length > 0) return { imported: [] }
    return await copyRepoSettings(fromPath, toPath)
  } catch {
    return { imported: [] }
  }
}

/**
 * Seed a linked worktree from its primary checkout. Companion data is keyed by
 * absolute path, so the same project seen through a worktree starts blank — this
 * carries actions/notes/board/layers/comments/scope across on first open. A
 * primary checkout, an unresolvable family, or a worktree that already has
 * settings all no-op.
 */
export async function seedWorktreeSettings(repoPath: string): Promise<ImportRepoSettingsResult> {
  if (!(await isLinkedWorktree(repoPath))) return { imported: [] }
  const primary = await primaryCheckoutPath(repoPath)
  if (primary === null) return { imported: [] }
  return seedRepoSettings(primary, repoPath)
}
