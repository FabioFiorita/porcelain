import { z } from 'zod'
import { reviewCommentsQuerySchema } from './comment-queries'

/** Typed Review identities that remain after the repo-local reading surface was retired. */
export class ReviewIdentityError extends Error {
  override readonly name = 'ReviewIdentityError'
}

const projectPathSchema = z.string().min(1)

export function reviewProjectKey(projectPath: string): string {
  const parsed = projectPathSchema.safeParse(projectPath)
  if (!parsed.success) throw new ReviewIdentityError('review: project path must be non-empty')
  return parsed.data
}

export const reviewedPathsQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('reviewed-paths'),
    projectPath: projectPathSchema,
  })
  .strict()

export const reviewQuerySchema = z.discriminatedUnion('name', [
  reviewedPathsQuerySchema,
  reviewCommentsQuerySchema,
])

export type ReviewQuery = Readonly<z.infer<typeof reviewQuerySchema>>
export type ReviewedPathsQuery = Readonly<z.infer<typeof reviewedPathsQuerySchema>>

export function reviewedPathsQuery(projectPath: string): ReviewedPathsQuery {
  return { domain: 'review', name: 'reviewed-paths', projectPath: reviewProjectKey(projectPath) }
}
