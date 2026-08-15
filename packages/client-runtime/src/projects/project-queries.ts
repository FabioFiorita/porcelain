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

const listCanvasesQuerySchema = z
  .object({
    domain: z.literal('projects'),
    name: z.literal('canvases'),
    projectId: z.string().min(1),
  })
  .strict()

const readCanvasQuerySchema = z
  .object({
    domain: z.literal('projects'),
    name: z.literal('canvas'),
    projectId: z.string().min(1),
    canvasId: z.string().min(1),
  })
  .strict()

export type RecentProjectsQuery = Readonly<z.infer<typeof recentProjectsQuerySchema>>
export type ProjectDirectoriesQuery = Readonly<z.infer<typeof projectDirectoriesQuerySchema>>
export type HubInventoryQuery = Readonly<z.infer<typeof hubInventoryQuerySchema>>
export type ListCanvasesQuery = Readonly<z.infer<typeof listCanvasesQuerySchema>>
export type ReadCanvasQuery = Readonly<z.infer<typeof readCanvasQuerySchema>>
export type ProjectsQuery = Readonly<
  | z.infer<typeof recentProjectsQuerySchema>
  | z.infer<typeof projectDirectoriesQuerySchema>
  | z.infer<typeof hubInventoryQuerySchema>
  | z.infer<typeof listCanvasesQuerySchema>
  | z.infer<typeof readCanvasQuerySchema>
>

export const projectsQuerySchema = z.discriminatedUnion('name', [
  recentProjectsQuerySchema,
  projectDirectoriesQuerySchema,
  hubInventoryQuerySchema,
  listCanvasesQuerySchema,
  readCanvasQuerySchema,
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

/** Build the Canvas list identity for one Project. */
export function listCanvasesQuery(projectId: string): ListCanvasesQuery {
  return { domain: 'projects', name: 'canvases', projectId }
}

/** Build the single-Canvas read identity. */
export function readCanvasQuery(projectId: string, canvasId: string): ReadCanvasQuery {
  return { domain: 'projects', name: 'canvas', projectId, canvasId }
}
