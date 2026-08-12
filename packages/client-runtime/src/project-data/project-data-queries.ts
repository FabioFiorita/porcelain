import { z } from 'zod'

/**
 * Typed Project Data query identities (PDT-003).
 *
 * Four product-distinct reads — notes, layers, dispositions, visibility — share a Project
 * path and nothing else. No absolute-path, host, or trailing-slash policy; the wire has none.
 * Empty path is a programmer error (`ProjectDataIdentityError`), not a public error code.
 */

/** Programmer error for an invalid Project Data project identity. */
export class ProjectDataIdentityError extends Error {
  override readonly name = 'ProjectDataIdentityError'
}

const projectPathSchema = z.string().min(1)

/** Normalize the project dimension shared by every Project Data identity. */
export function projectDataProjectKey(projectPath: string): string {
  const parsed = projectPathSchema.safeParse(projectPath)
  if (!parsed.success) {
    throw new ProjectDataIdentityError('project-data: project path must be non-empty')
  }
  return parsed.data
}

export const projectDataNotesQuerySchema = z
  .object({
    domain: z.literal('project-data'),
    name: z.literal('notes'),
    projectPath: projectPathSchema,
  })
  .strict()

export const projectDataLayersQuerySchema = z
  .object({
    domain: z.literal('project-data'),
    name: z.literal('layers'),
    projectPath: projectPathSchema,
  })
  .strict()

export const projectDataDispositionsQuerySchema = z
  .object({
    domain: z.literal('project-data'),
    name: z.literal('dispositions'),
    projectPath: projectPathSchema,
  })
  .strict()

export const projectDataVisibilityQuerySchema = z
  .object({
    domain: z.literal('project-data'),
    name: z.literal('visibility'),
    projectPath: projectPathSchema,
  })
  .strict()

/** Any Project Data server-state identity, discriminated by `name`. */
export const projectDataQuerySchema = z.discriminatedUnion('name', [
  projectDataNotesQuerySchema,
  projectDataLayersQuerySchema,
  projectDataDispositionsQuerySchema,
  projectDataVisibilityQuerySchema,
])

export type ProjectDataQuery = Readonly<z.infer<typeof projectDataQuerySchema>>

/** Build the notes identity for a Project path. */
export function projectDataNotesQuery(projectPath: string): ProjectDataQuery {
  return {
    domain: 'project-data',
    name: 'notes',
    projectPath: projectDataProjectKey(projectPath),
  }
}

/** Build the layers identity for a Project path. */
export function projectDataLayersQuery(projectPath: string): ProjectDataQuery {
  return {
    domain: 'project-data',
    name: 'layers',
    projectPath: projectDataProjectKey(projectPath),
  }
}

/** Build the companion-dispositions identity for a Project path. */
export function projectDataDispositionsQuery(projectPath: string): ProjectDataQuery {
  return {
    domain: 'project-data',
    name: 'dispositions',
    projectPath: projectDataProjectKey(projectPath),
  }
}

/** Build the companion-visibility identity for a Project path. */
export function projectDataVisibilityQuery(projectPath: string): ProjectDataQuery {
  return {
    domain: 'project-data',
    name: 'visibility',
    projectPath: projectDataProjectKey(projectPath),
  }
}
