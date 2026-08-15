import type { BrowseDirsInput, ProjectInfo } from '@porcelain/contracts/projects'
import { z } from 'zod'

/** Presentation summary returned by the daemon; PRJ-003 owns the final product vocabulary. */
export type ProjectSummary = ProjectInfo

const recentProjectsQuerySchema = z
  .object({
    domain: z.literal('projects'),
    name: z.literal('recent'),
    includeWorktrees: z.boolean(),
  })
  .strict()

const projectDirectoriesQuerySchema = z
  .object({
    domain: z.literal('projects'),
    name: z.literal('directories'),
    path: z.string().nullable(),
  })
  .strict()

const hubInventoryQuerySchema = z
  .object({
    domain: z.literal('projects'),
    name: z.literal('inventory'),
  })
  .strict()

/**
 * The addressed checkout whose tracked `.porcelain/` overlay is merged over the
 * private records (#26). Part of the cache identity, never a detail: the same
 * Canvas id resolves to different bytes in different checkouts, so a shared key
 * would serve one Worktree's promoted copy to another. `null` is the honest
 * "no checkout addressed" identity — only private records.
 */
const worktreePathIdentitySchema = z.string().min(1).nullable()

const listCanvasesQuerySchema = z
  .object({
    domain: z.literal('projects'),
    name: z.literal('canvases'),
    projectId: z.string().min(1),
    worktreePath: worktreePathIdentitySchema,
  })
  .strict()

const readCanvasQuerySchema = z
  .object({
    domain: z.literal('projects'),
    name: z.literal('canvas'),
    projectId: z.string().min(1),
    canvasId: z.string().min(1),
    worktreePath: worktreePathIdentitySchema,
  })
  .strict()

const overlayQuerySchema = z
  .object({
    domain: z.literal('projects'),
    name: z.literal('overlay'),
    path: z.string().min(1),
  })
  .strict()

export type RecentProjectsQuery = Readonly<z.infer<typeof recentProjectsQuerySchema>>
export type ProjectDirectoriesQuery = Readonly<z.infer<typeof projectDirectoriesQuerySchema>>
export type HubInventoryQuery = Readonly<z.infer<typeof hubInventoryQuerySchema>>
export type ListCanvasesQuery = Readonly<z.infer<typeof listCanvasesQuerySchema>>
export type ReadCanvasQuery = Readonly<z.infer<typeof readCanvasQuerySchema>>
export type OverlayQuery = Readonly<z.infer<typeof overlayQuerySchema>>
export type ProjectsQuery = Readonly<
  | z.infer<typeof recentProjectsQuerySchema>
  | z.infer<typeof projectDirectoriesQuerySchema>
  | z.infer<typeof hubInventoryQuerySchema>
  | z.infer<typeof listCanvasesQuerySchema>
  | z.infer<typeof readCanvasQuerySchema>
  | z.infer<typeof overlayQuerySchema>
>

export const projectsQuerySchema = z.discriminatedUnion('name', [
  recentProjectsQuerySchema,
  projectDirectoriesQuerySchema,
  hubInventoryQuerySchema,
  listCanvasesQuerySchema,
  readCanvasQuerySchema,
  overlayQuerySchema,
])

/** Build the recent-project identity; the worktree flag is part of the cache identity. */
export function recentProjectsQuery(includeWorktrees = false): RecentProjectsQuery {
  return { domain: 'projects', name: 'recent', includeWorktrees }
}

/** Build the nullable-root directory-browser identity without normalizing the daemon path. */
export function projectDirectoriesQuery(path: BrowseDirsInput): ProjectDirectoriesQuery {
  return { domain: 'projects', name: 'directories', path }
}

/** Build the Hub inventory identity for one Environment daemon. */
export function hubInventoryQuery(): HubInventoryQuery {
  return { domain: 'projects', name: 'inventory' }
}

/** Build the Canvas list identity for one Project, scoped to the addressed checkout. */
export function listCanvasesQuery(
  projectId: string,
  worktreePath: string | null = null,
): ListCanvasesQuery {
  return { domain: 'projects', name: 'canvases', projectId, worktreePath }
}

/** Build the single-Canvas read identity, scoped to the addressed checkout. */
export function readCanvasQuery(
  projectId: string,
  canvasId: string,
  worktreePath: string | null = null,
): ReadCanvasQuery {
  return { domain: 'projects', name: 'canvas', projectId, canvasId, worktreePath }
}

/** Build the identity for what one checkout's tracked `.porcelain/` overlay carries. */
export function overlayQuery(path: string): OverlayQuery {
  return { domain: 'projects', name: 'overlay', path }
}
