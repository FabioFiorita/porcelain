import { z } from 'zod'
import { diffHunkSchema, fileStatusSchema } from '../git'

const MAX_DOCUMENTS = 12
const MAX_EVIDENCE_DOCUMENTS = MAX_DOCUMENTS + 1
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024
const MAX_HTML_BYTES = 4_194_304
const MAX_ASSETS = 60
const MAX_ASSET_BYTES = 8 * 1024 * 1024
const MAX_CHECKS = 32
const MAX_CHECK_LABEL = 120
const MAX_CHECK_DETAIL = 400
const MAX_THESIS = 4096
const MAX_SECTION_TITLE = 200
const MAX_SECTION_PROSE = 32_768
const MAX_SECTION_DIAGRAM = 262_144
const MAX_SECTION_HTML = 524_288

export const fileSourceSchema = z.enum(['changed', 'context', 'shipped'])
export type FileSource = z.infer<typeof fileSourceSchema>
export type FileStatus = z.infer<typeof fileStatusSchema>

export const sliceRangeSchema = z
  .object({
    startLine: z.number().int().positive(),
    lines: z.array(z.string()),
    gapBefore: z.number().int().nonnegative(),
  })
  .strict()

export type SliceRange = z.infer<typeof sliceRangeSchema>

export const readingFileSchema = z
  .object({
    path: z.string(),
    source: fileSourceSchema,
    note: z.string().optional(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    status: fileStatusSchema.optional(),
    hunks: z.array(diffHunkSchema).optional(),
    ranges: z.array(sliceRangeSchema).optional(),
    truncated: z.boolean().optional(),
    whole: z.boolean().optional(),
  })
  .strict()

export type ReadingFile = z.infer<typeof readingFileSchema>

const featureFileSchema = z
  .object({
    path: z.string(),
    source: fileSourceSchema,
    status: fileStatusSchema.optional(),
    note: z.string().optional(),
    layer: z.string().optional(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    connects: z.array(z.string()),
  })
  .strict()

const featureGroupSchema = z
  .object({
    layer: z.string(),
    files: z.array(featureFileSchema),
  })
  .strict()

const featureSectionOutlineSchema = z
  .object({
    title: z.string().min(1).max(MAX_SECTION_TITLE),
    anchorCount: z.number().int().min(0).max(40),
  })
  .strict()

export const featureViewObjectSchema = z
  .object({
    name: z.string(),
    fromAgent: z.boolean(),
    thesis: z.string().max(MAX_THESIS).optional(),
    sections: z.array(featureSectionOutlineSchema).max(30),
    groups: z.array(featureGroupSchema),
  })
  .strict()

export const featureViewSchema = featureViewObjectSchema.nullable()
export type FeatureView = z.infer<typeof featureViewObjectSchema>
export type FeatureViewOutput = z.infer<typeof featureViewSchema>

const reviewSectionReadingSchema = z
  .object({
    title: z.string().min(1).max(MAX_SECTION_TITLE),
    prose: z.string().max(MAX_SECTION_PROSE),
    diagram: z.string().max(MAX_SECTION_DIAGRAM).optional(),
    html: z.string().max(MAX_SECTION_HTML).optional(),
    htmlHeight: z.number().int().min(160).max(1600).optional(),
    files: z.array(readingFileSchema),
  })
  .strict()

const readingGroupSchema = z
  .object({
    layer: z.string(),
    files: z.array(readingFileSchema),
  })
  .strict()

export const reviewCanvasSchema = z.discriminatedUnion('medium', [
  z
    .object({
      medium: z.literal('html'),
      html: z.string().min(1).max(MAX_SECTION_HTML),
    })
    .strict(),
])

const featureReadingEvidenceSchema = z
  .object({
    title: z.string(),
    updatedAt: z.string(),
    checks: z
      .array(
        z
          .object({
            label: z.string().min(1).max(MAX_CHECK_LABEL),
            status: z.enum(['pass', 'fail', 'skip']),
            detail: z.string().max(MAX_CHECK_DETAIL).optional(),
          })
          .strict(),
      )
      .max(MAX_CHECKS),
    medium: z.literal('html'),
  })
  .strict()

export const featureReadingSchema = z
  .object({
    name: z.string(),
    thesis: z.string().max(MAX_THESIS).optional(),
    sections: z.array(reviewSectionReadingSchema).max(30),
    groups: z.array(readingGroupSchema),
    canvas: reviewCanvasSchema.optional(),
    evidence: featureReadingEvidenceSchema.nullable(),
  })
  .strict()

export const featureReadingOutputSchema = featureReadingSchema.nullable()
export type FeatureReading = z.infer<typeof featureReadingSchema>
export type FeatureReadingOutput = z.infer<typeof featureReadingOutputSchema>

export const reviewDocSchema = z.discriminatedUnion('medium', [
  z
    .object({
      file: z.string(),
      label: z.string(),
      medium: z.literal('markdown'),
      body: z.string().max(MAX_DOCUMENT_BYTES),
    })
    .strict(),
  z
    .object({
      file: z.string(),
      label: z.string(),
      medium: z.literal('html'),
      body: z.string().max(MAX_DOCUMENT_BYTES),
    })
    .strict(),
])

export type ReviewDoc = z.infer<typeof reviewDocSchema>
export const reviewIntentOutputSchema = z.array(reviewDocSchema).max(MAX_DOCUMENTS)
export const reviewEvidenceDocsOutputSchema = z.array(reviewDocSchema).max(MAX_EVIDENCE_DOCUMENTS)

const evidenceCheckSchema = z
  .object({
    label: z.string().min(1).max(MAX_CHECK_LABEL),
    status: z.enum(['pass', 'fail', 'skip']),
    detail: z.string().max(MAX_CHECK_DETAIL).optional(),
  })
  .strict()

export type EvidenceCheck = z.infer<typeof evidenceCheckSchema>

export const evidenceMetaSchema = z
  .object({
    title: z.string(),
    updatedAt: z.string(),
    checks: z.array(evidenceCheckSchema).max(MAX_CHECKS),
    dir: z.string().optional(),
    medium: z.literal('html'),
    results: z.number().optional(),
    assets: z.number().optional(),
    hasReport: z.boolean().optional(),
  })
  .strict()

export type EvidenceMeta = z.infer<typeof evidenceMetaSchema>

const evidenceBaseShape = {
  title: z.string(),
  updatedAt: z.string(),
  dir: z.string().optional(),
  checks: z.array(evidenceCheckSchema).max(MAX_CHECKS),
  medium: z.literal('html'),
} as const

const evidenceHtmlSchema = z
  .object({
    ...evidenceBaseShape,
    html: z.string().max(MAX_HTML_BYTES),
  })
  .strict()

const evidenceUnavailableSchema = z
  .object({
    ...evidenceBaseShape,
    htmlUnavailable: z
      .object({
        reason: z.literal('too-large'),
        bytes: z.number(),
        maxBytes: z.number(),
      })
      .strict(),
  })
  .strict()

export const evidenceSchema = z.union([evidenceHtmlSchema, evidenceUnavailableSchema])
export type Evidence = z.infer<typeof evidenceSchema>

export const evidenceAssetSchema = z
  .object({
    file: z.string(),
    label: z.string(),
    kind: z.literal('image'),
    mime: z.string(),
    bytes: z.number(),
  })
  .strict()

export type EvidenceAsset = z.infer<typeof evidenceAssetSchema>
export const reviewEvidenceAssetsOutputSchema = z.array(evidenceAssetSchema).max(MAX_ASSETS)

export const evidenceAssetBodySchema = z
  .object({
    file: z.string(),
    mime: z.string(),
    bytes: z.number().max(MAX_ASSET_BYTES),
    dataUrl: z.string(),
  })
  .strict()

export type EvidenceAssetBody = z.infer<typeof evidenceAssetBodySchema>

export const reviewCommentSchema = z
  .object({
    id: z.string(),
    path: z.string().min(1),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    anchorText: z.string().optional(),
    body: z.string(),
    resolved: z.boolean(),
    createdAt: z.number(),
    agentReply: z.object({ body: z.string(), createdAt: z.number() }).strict().optional(),
  })
  .strict()

export type ReviewComment = z.infer<typeof reviewCommentSchema>

export const worktreeInboxRowSchema = z
  .object({
    path: z.string(),
    branch: z.string(),
    changedCount: z.number(),
    hasReview: z.boolean(),
  })
  .strict()

export type WorktreeInboxRow = z.infer<typeof worktreeInboxRowSchema>
export const worktreeInboxOutputSchema = z.array(worktreeInboxRowSchema)

export const publishCostSchema = z.object({ bytes: z.number(), files: z.number() }).strict()
export type PublishCost = z.infer<typeof publishCostSchema>

export const publishResultSchema = z.object({ id: z.string(), cost: publishCostSchema }).strict()
export type PublishResult = z.infer<typeof publishResultSchema>

export const archivedReviewSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    thesis: z.string().max(MAX_THESIS).optional(),
    archivedAt: z.string(),
  })
  .strict()

export type ArchivedReview = z.infer<typeof archivedReviewSchema>
export const archivedReviewsOutputSchema = z.array(archivedReviewSchema)

export const exploreFeatureInputSchema = z
  .object({
    repoPath: z.string(),
    seed: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('file'), path: z.string() }).strict(),
      z.object({ kind: z.literal('symbol'), path: z.string(), symbol: z.string() }).strict(),
    ]),
  })
  .strict()

export const reviewEvidenceAssetInputSchema = z
  .object({ repoPath: z.string(), file: z.string().min(1) })
  .strict()

export const worktreeInboxInputSchema = z.string()
export const markReviewedInputSchema = z.object({ repoPath: z.string(), path: z.string() }).strict()
export const unmarkReviewedInputSchema = markReviewedInputSchema
export const reviewedPathsInputSchema = z.string()
export const reviewedPathsOutputSchema = z.array(z.string())
export const setReviewedInputSchema = z
  .object({ repoPath: z.string(), paths: z.array(z.string()) })
  .strict()

export const reviewRepoPathInputSchema = z.string()
export const voidOutputSchema = z.void()
export const restoreArchivedReviewInputSchema = z
  .object({ repoPath: z.string(), id: z.string().min(1) })
  .strict()
export const deleteArchivedReviewInputSchema = restoreArchivedReviewInputSchema
export const editReviewCommentInputSchema = z
  .object({ repoPath: z.string(), id: z.string().min(1), body: z.string().min(1) })
  .strict()
export const deleteReviewCommentInputSchema = z
  .object({ repoPath: z.string(), id: z.string().min(1) })
  .strict()
export const clearResolvedReviewCommentsInputSchema = z.object({ repoPath: z.string() }).strict()
export const resolveReviewCommentInputSchema = z
  .object({ repoPath: z.string(), id: z.string().min(1), resolved: z.boolean() })
  .strict()
export const addReviewCommentInputSchema = z
  .object({
    repoPath: z.string(),
    path: z.string().min(1),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    anchorText: z.string().optional(),
    body: z.string().min(1),
  })
  .strict()

export type WorktreeInboxInput = z.infer<typeof worktreeInboxInputSchema>
export type ReviewedPathsInput = z.infer<typeof reviewedPathsInputSchema>
export type ReviewedPathsOutput = z.infer<typeof reviewedPathsOutputSchema>
export type MarkReviewedInput = z.infer<typeof markReviewedInputSchema>
export type UnmarkReviewedInput = z.infer<typeof unmarkReviewedInputSchema>
export type SetReviewedInput = z.infer<typeof setReviewedInputSchema>
export type ReviewRepoPathInput = z.infer<typeof reviewRepoPathInputSchema>
export type ReviewVoidOutput = z.infer<typeof voidOutputSchema>
export type ReviewEvidenceAssetInput = z.infer<typeof reviewEvidenceAssetInputSchema>
export type RestoreArchivedReviewInput = z.infer<typeof restoreArchivedReviewInputSchema>
export type DeleteArchivedReviewInput = z.infer<typeof deleteArchivedReviewInputSchema>
export type EditReviewCommentInput = z.infer<typeof editReviewCommentInputSchema>
export type DeleteReviewCommentInput = z.infer<typeof deleteReviewCommentInputSchema>
export type ClearResolvedReviewCommentsInput = z.infer<
  typeof clearResolvedReviewCommentsInputSchema
>
export type ResolveReviewCommentInput = z.infer<typeof resolveReviewCommentInputSchema>
export type AddReviewCommentInput = z.infer<typeof addReviewCommentInputSchema>
export type ExploreFeatureInput = z.infer<typeof exploreFeatureInputSchema>

export { reviewContractFixtures } from './review.fixtures'
