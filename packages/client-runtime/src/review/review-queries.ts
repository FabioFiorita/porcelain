import { z } from 'zod'
import { reviewCommentsQuerySchema } from './comment-queries'

/**
 * Typed Review query identities outside comments (REV-006).
 *
 * One owner for every non-comment Review server-state identity. Four of them —
 * `reading`, `view`, `reviewed-paths` and `worktree-inbox` — were declared in the Git
 * slice before this unit and keep their exact object shape here, so every cache key both
 * clients already hold stays valid. Product language is `projectPath`; the wire's
 * `repoPath` is mapped at the adapter boundary. Empty path is a programmer error
 * (`ReviewIdentityError`), never a public error code, and identity construction is pure.
 */

/** Programmer error for an invalid Review project identity. */
export class ReviewIdentityError extends Error {
  override readonly name = 'ReviewIdentityError'
}

const projectPathSchema = z.string().min(1)
const fileDimensionSchema = z.string().min(1)

/** Normalize the project dimension shared by every Review identity. */
export function reviewProjectKey(projectPath: string): string {
  const parsed = projectPathSchema.safeParse(projectPath)
  if (!parsed.success) {
    throw new ReviewIdentityError('review: project path must be non-empty')
  }
  return parsed.data
}

const exploreSeedSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('file'), path: z.string() }).strict(),
  z.object({ kind: z.literal('symbol'), path: z.string(), symbol: z.string() }).strict(),
])

/** Explore seed dimension, mirroring the live `exploreFeature` input seed. */
export type ReviewExploreSeed = Readonly<z.infer<typeof exploreSeedSchema>>

export const reviewViewQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('view'),
    projectPath: projectPathSchema,
  })
  .strict()

export const reviewReadingQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('reading'),
    projectPath: projectPathSchema,
  })
  .strict()

const reviewIntentQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('intent'),
    projectPath: projectPathSchema,
  })
  .strict()

const reviewEvidenceQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('evidence'),
    projectPath: projectPathSchema,
  })
  .strict()

const reviewEvidenceHtmlQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('evidence-html'),
    projectPath: projectPathSchema,
  })
  .strict()

const reviewEvidenceDocsQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('evidence-docs'),
    projectPath: projectPathSchema,
  })
  .strict()

const reviewEvidenceAssetsQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('evidence-assets'),
    projectPath: projectPathSchema,
  })
  .strict()

const reviewEvidenceAssetQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('evidence-asset'),
    projectPath: projectPathSchema,
    file: fileDimensionSchema,
  })
  .strict()

const reviewPublishCostQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('publish-cost'),
    projectPath: projectPathSchema,
  })
  .strict()

const reviewArchivedQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('archived'),
    projectPath: projectPathSchema,
  })
  .strict()

export const reviewedPathsQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('reviewed-paths'),
    projectPath: projectPathSchema,
  })
  .strict()

export const worktreeInboxQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('worktree-inbox'),
    projectPath: projectPathSchema,
  })
  .strict()

const reviewExploreQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('explore'),
    projectPath: projectPathSchema,
    seed: exploreSeedSchema,
  })
  .strict()

/**
 * Any Review server-state identity, discriminated by `name`. The comments identity is
 * imported from its RVC-002 owner rather than redeclared, so one Review key namespace
 * parses with exactly one constructor per identity.
 */
export const reviewQuerySchema = z.discriminatedUnion('name', [
  reviewViewQuerySchema,
  reviewReadingQuerySchema,
  reviewIntentQuerySchema,
  reviewEvidenceQuerySchema,
  reviewEvidenceHtmlQuerySchema,
  reviewEvidenceDocsQuerySchema,
  reviewEvidenceAssetsQuerySchema,
  reviewEvidenceAssetQuerySchema,
  reviewPublishCostQuerySchema,
  reviewArchivedQuerySchema,
  reviewedPathsQuerySchema,
  worktreeInboxQuerySchema,
  reviewExploreQuerySchema,
  reviewCommentsQuerySchema,
])

export type ReviewQuery = Readonly<z.infer<typeof reviewQuerySchema>>

export type ReviewViewQuery = Readonly<z.infer<typeof reviewViewQuerySchema>>
export type ReviewReadingQuery = Readonly<z.infer<typeof reviewReadingQuerySchema>>
export type ReviewIntentQuery = Readonly<z.infer<typeof reviewIntentQuerySchema>>
export type ReviewEvidenceQuery = Readonly<z.infer<typeof reviewEvidenceQuerySchema>>
export type ReviewEvidenceHtmlQuery = Readonly<z.infer<typeof reviewEvidenceHtmlQuerySchema>>
export type ReviewEvidenceDocsQuery = Readonly<z.infer<typeof reviewEvidenceDocsQuerySchema>>
export type ReviewEvidenceAssetsQuery = Readonly<z.infer<typeof reviewEvidenceAssetsQuerySchema>>
export type ReviewEvidenceAssetQuery = Readonly<z.infer<typeof reviewEvidenceAssetQuerySchema>>
export type ReviewPublishCostQuery = Readonly<z.infer<typeof reviewPublishCostQuerySchema>>
export type ReviewArchivedQuery = Readonly<z.infer<typeof reviewArchivedQuerySchema>>
export type ReviewedPathsQuery = Readonly<z.infer<typeof reviewedPathsQuerySchema>>
export type WorktreeInboxQuery = Readonly<z.infer<typeof worktreeInboxQuerySchema>>
export type ReviewExploreQuery = Readonly<z.infer<typeof reviewExploreQuerySchema>>

export function reviewViewQuery(projectPath: string): ReviewViewQuery {
  return { domain: 'review', name: 'view', projectPath: reviewProjectKey(projectPath) }
}

export function reviewReadingQuery(projectPath: string): ReviewReadingQuery {
  return { domain: 'review', name: 'reading', projectPath: reviewProjectKey(projectPath) }
}

export function reviewIntentQuery(projectPath: string): ReviewIntentQuery {
  return { domain: 'review', name: 'intent', projectPath: reviewProjectKey(projectPath) }
}

export function reviewEvidenceQuery(projectPath: string): ReviewEvidenceQuery {
  return { domain: 'review', name: 'evidence', projectPath: reviewProjectKey(projectPath) }
}

export function reviewEvidenceHtmlQuery(projectPath: string): ReviewEvidenceHtmlQuery {
  return { domain: 'review', name: 'evidence-html', projectPath: reviewProjectKey(projectPath) }
}

export function reviewEvidenceDocsQuery(projectPath: string): ReviewEvidenceDocsQuery {
  return { domain: 'review', name: 'evidence-docs', projectPath: reviewProjectKey(projectPath) }
}

export function reviewEvidenceAssetsQuery(projectPath: string): ReviewEvidenceAssetsQuery {
  return { domain: 'review', name: 'evidence-assets', projectPath: reviewProjectKey(projectPath) }
}

export function reviewEvidenceAssetQuery(
  projectPath: string,
  file: string,
): ReviewEvidenceAssetQuery {
  return {
    domain: 'review',
    name: 'evidence-asset',
    projectPath: reviewProjectKey(projectPath),
    file,
  }
}

export function reviewPublishCostQuery(projectPath: string): ReviewPublishCostQuery {
  return { domain: 'review', name: 'publish-cost', projectPath: reviewProjectKey(projectPath) }
}

export function reviewArchivedQuery(projectPath: string): ReviewArchivedQuery {
  return { domain: 'review', name: 'archived', projectPath: reviewProjectKey(projectPath) }
}

export function reviewedPathsQuery(projectPath: string): ReviewedPathsQuery {
  return { domain: 'review', name: 'reviewed-paths', projectPath: reviewProjectKey(projectPath) }
}

export function worktreeInboxQuery(projectPath: string): WorktreeInboxQuery {
  return { domain: 'review', name: 'worktree-inbox', projectPath: reviewProjectKey(projectPath) }
}

export function reviewExploreQuery(
  projectPath: string,
  seed: ReviewExploreSeed,
): ReviewExploreQuery {
  return {
    domain: 'review',
    name: 'explore',
    projectPath: reviewProjectKey(projectPath),
    seed,
  }
}
