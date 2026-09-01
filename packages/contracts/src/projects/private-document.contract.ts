import { z } from 'zod'
import { persistedWorktreeProfileSchema, profileLayerSchema } from '../worktree-profile'
import type { ProjectOverrides } from './projects.contract'

/**
 * The PRIVATE project document — a superset of the promotable overlay.
 *
 * `layers` and `worktreeProfiles` are the personal half of the worktree profile. They live only
 * in the daemon-root Project record, never
 * in the tracked `<repo>/.porcelain/project.json`: a teammate who pulls someone
 * else's layer order inherits a story written for a task they are not doing.
 *
 * Every field defaults, so a document written by an older Porcelain — or by a
 * hand-edit that dropped a key — parses instead of resetting someone's focus.
 */
const currentPrivateProjectDocumentSchema = z
  .object({
    hiddenPaths: z.array(z.string()).default([]),
    pinnedPaths: z.array(z.string()).default([]),
    /** Project-level story order — the baseline every worktree inherits. */
    layers: z.array(profileLayerSchema).default([]),
    /** Keyed by stable Worktree id, so a branch rename does not orphan an override. */
    worktreeProfiles: z.record(z.string(), persistedWorktreeProfileSchema).default({}),
  })
  .strict()

export const privateProjectDocumentSchema = z.preprocess((value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const { worktrees: _retired, ...current } = value as Record<string, unknown>
  return current
}, currentPrivateProjectDocumentSchema)
export type PrivateProjectDocument = z.infer<typeof privateProjectDocumentSchema>

export const emptyPrivateProjectDocument = (): PrivateProjectDocument => ({
  hiddenPaths: [],
  pinnedPaths: [],
  layers: [],
  worktreeProfiles: {},
})

/**
 * Drop the personal half before anything writes into a checkout.
 *
 * Promotion is the obvious caller, but the READ path calls it too: a tracked
 * `project.json` that somebody hand-wrote `layers` into would otherwise smuggle
 * a shared story order back in through the merge. Stripping on read makes that impossible rather
 * than discouraged.
 */
export function stripPersonalProfileFields(
  document: PrivateProjectDocument | ProjectOverrides,
): ProjectOverrides {
  return {
    hiddenPaths: document.hiddenPaths,
    pinnedPaths: document.pinnedPaths,
  }
}
