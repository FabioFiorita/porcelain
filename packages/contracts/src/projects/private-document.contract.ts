import { z } from 'zod'
import { profileLayerSchema, worktreeProfileSchema } from '../worktree-profile'
import { type ProjectOverrides, projectOverridesSchema } from './projects.contract'

/**
 * The PRIVATE project document — a superset of the promotable overlay.
 *
 * `layers` and `worktreeProfiles` are the personal half of the worktree profile
 * (ADR 0003, ADR 0006). They live only in the daemon-root Project record, never
 * in the tracked `<repo>/.porcelain/project.json`: a teammate who pulls someone
 * else's layer order inherits a story written for a task they are not doing.
 *
 * Every field defaults, so a document written by an older Porcelain — or by a
 * hand-edit that dropped a key — parses instead of resetting someone's focus.
 */
export const privateProjectDocumentSchema = projectOverridesSchema
  .extend({
    hiddenPaths: z.array(z.string()).default([]),
    pinnedPaths: z.array(z.string()).default([]),
    worktrees: projectOverridesSchema.shape.worktrees.default({}),
    /** Project-level story order — the baseline every worktree inherits. */
    layers: z.array(profileLayerSchema).default([]),
    /** Keyed by stable Worktree id, so a branch rename does not orphan an override. */
    worktreeProfiles: z.record(z.string(), worktreeProfileSchema).default({}),
  })
  .strict()
export type PrivateProjectDocument = z.infer<typeof privateProjectDocumentSchema>

export const emptyPrivateProjectDocument = (): PrivateProjectDocument => ({
  hiddenPaths: [],
  pinnedPaths: [],
  worktrees: {},
  layers: [],
  worktreeProfiles: {},
})

/**
 * Drop the personal half before anything writes into a checkout.
 *
 * Promotion is the obvious caller, but the READ path calls it too: a tracked
 * `project.json` that somebody hand-wrote `layers` into would otherwise smuggle
 * a shared story order back in through the merge, which is precisely what ADR
 * 0006 forbids. Stripping on read makes that impossible rather than discouraged.
 */
export function stripPersonalProfileFields(
  document: PrivateProjectDocument | ProjectOverrides,
): ProjectOverrides {
  return {
    hiddenPaths: document.hiddenPaths,
    pinnedPaths: document.pinnedPaths,
    worktrees: document.worktrees,
  }
}
