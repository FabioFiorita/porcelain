import { z } from 'zod'

/**
 * The worktree profile: pinned paths, hidden paths, and declared story layers. This is a shared
 * model rather than one domain's contract because the
 * Project store owns the document, Files serves it to the tree, and Git orders a
 * changeset with it — three domains reading one shape.
 *
 * The profile has TWO levels and the lower one is the default:
 *
 * - **project** — personal, private, per repository. The boring baseline that is
 *   true whatever you are working on: dependency directories, build output,
 *   generated code, the files you open on any task.
 * - **worktree** — the optional add-on. Absent on most worktrees, and a worktree
 *   with no override simply inherits the project profile. This is what makes the
 *   whole mechanism free for someone who does not use worktrees at all.
 *
 * Inheritance is LIVE, not a copy taken when the worktree was created. Editing
 * the project profile moves every worktree that has not overridden it, which is
 * the entire point — a snapshot per worktree recreates the stale-setup problem
 * the profile exists to solve.
 *
 * Both levels are personal. Neither is promoted into Git, so the
 * tracked `.porcelain/project.json` overlay never carries `layers` or
 * `worktreeProfiles` — see `stripPersonalProfileFields`.
 */

/**
 * One declared story layer: a label and the pattern that claims a path for it.
 *
 * Declarative on purpose. Porcelain never infers layers from framework
 * conventions, directory names, or the import graph, because a confident wrong
 * order is worse than none — it makes a reader trust a story that isn't true.
 */
export const profileLayerSchema = z
  .object({ label: z.string().min(1), pattern: z.string().min(1) })
  .strict()
export type ProfileLayer = z.infer<typeof profileLayerSchema>

/**
 * One worktree's override of the project story order. Navigation paths belong
 * to the project, so every checkout of that project sees the same pins/hides.
 *
 * `layers` REPLACES wholesale when non-null. There is no sensible interleave of
 * a web sequence and a mobile one; merging two declared orderings produces a
 * third that neither of them meant. `null` means "inherit the project's order",
 * and `[]` means "don't" — a mobile worktree in a repository whose project
 * profile declares a web sequence wants none of it, and falls back to the
 * starters rather than reading its changes through someone else's story.
 */
export const worktreeProfileSchema = z
  .object({
    layers: z.array(profileLayerSchema).nullable().default(null),
  })
  .strict()
export type WorktreeProfile = z.infer<typeof worktreeProfileSchema>

export const emptyWorktreeProfile = (): WorktreeProfile => ({ layers: null })

/** Read old stored overrides while deliberately discarding retired path fields. */
export const persistedWorktreeProfileSchema = z.preprocess((value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  return { layers: 'layers' in value ? value.layers : null }
}, worktreeProfileSchema)

/** What a tree, a search, or a changeset actually applies: one level, already merged. */
export const resolvedProfileSchema = z
  .object({
    pinnedPaths: z.array(z.string()),
    hiddenPaths: z.array(z.string()),
    layers: z.array(profileLayerSchema),
  })
  .strict()
export type ResolvedProfile = z.infer<typeof resolvedProfileSchema>

/**
 * Merge a worktree override onto the project baseline.
 *
 * Pure, and deliberately the ONE place the two levels meet: every consumer —
 * the file tree, repository search, and changeset ordering — reads the result of
 * this function rather than re-deciding what inheritance means.
 */
export function resolveProfile(
  base: ResolvedProfile,
  override: WorktreeProfile | null,
): ResolvedProfile {
  if (override === null) return { ...base }
  return {
    pinnedPaths: [...base.pinnedPaths],
    hiddenPaths: [...base.hiddenPaths],
    layers: override.layers ?? base.layers,
  }
}

/** True when this override says nothing — the worktree is purely inheriting. */
export function isEmptyWorktreeProfile(profile: WorktreeProfile | null): boolean {
  return profile === null || profile.layers === null
}
