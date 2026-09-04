import { z } from 'zod'
import { diffHunkSchema, fileStatusSchema } from '../git'

/**
 * The canonical Review models.
 *
 * One wire, one vocabulary: these shapes are what `review.procedures.ts` composes into
 * `procedure-catalog.ts` and what every router, client, and CLI caller binds.
 */

const MAX_DOCUMENTS = 12
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024
const MAX_ASSETS = 60
const MAX_ASSET_BYTES = 8 * 1024 * 1024
const MAX_CHECKS = 32
const MAX_CHECK_LABEL = 120
const MAX_CHECK_DETAIL = 400
const MAX_THESIS = 4096
const MAX_SECTIONS = 30
const MAX_SECTION_TITLE = 200
const MAX_SECTION_PROSE = 32_768
const MAX_SECTION_DIAGRAM = 262_144
const MAX_SECTION_HTML = 524_288

/* Reading primitives */

export const fileSourceSchema = z.enum(['changed', 'context', 'shipped'])
export type FileSource = z.infer<typeof fileSourceSchema>

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
    path: z.string().min(1),
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

export const readingGroupSchema = z
  .object({
    layer: z.string(),
    files: z.array(readingFileSchema),
  })
  .strict()

export type ReadingGroup = z.infer<typeof readingGroupSchema>

export const reviewSectionSchema = z
  .object({
    title: z.string().min(1).max(MAX_SECTION_TITLE),
    prose: z.string().max(MAX_SECTION_PROSE),
    diagram: z.string().max(MAX_SECTION_DIAGRAM).optional(),
    html: z.string().max(MAX_SECTION_HTML).optional(),
    htmlHeight: z.number().int().min(160).max(1600).optional(),
    files: z.array(readingFileSchema),
  })
  .strict()

export type ReviewSection = z.infer<typeof reviewSectionSchema>

/* Reading */

export const evidenceCheckSchema = z
  .object({
    label: z.string().min(1).max(MAX_CHECK_LABEL),
    status: z.enum(['pass', 'fail', 'skip']),
    detail: z.string().max(MAX_CHECK_DETAIL).optional(),
  })
  .strict()

export type EvidenceCheck = z.infer<typeof evidenceCheckSchema>

export const reviewReadingEvidenceSchema = z
  .object({
    title: z.string(),
    updatedAt: z.string(),
    checks: z.array(evidenceCheckSchema).max(MAX_CHECKS),
  })
  .strict()

export const reviewReadingSchema = z
  .object({
    name: z.string(),
    thesis: z.string().max(MAX_THESIS).optional(),
    sections: z.array(reviewSectionSchema).max(MAX_SECTIONS),
    groups: z.array(readingGroupSchema),
    evidence: reviewReadingEvidenceSchema.nullable(),
  })
  .strict()

export const reviewReadingOutputSchema = reviewReadingSchema.nullable()
export type ReviewReading = z.infer<typeof reviewReadingSchema>
export type ReviewReadingOutput = z.infer<typeof reviewReadingOutputSchema>

/* Documents — Intent and Evidence Results share the primitive */

export const reviewDocSchema = z.discriminatedUnion('medium', [
  z
    .object({
      file: z.string().min(1),
      label: z.string(),
      medium: z.literal('markdown'),
      body: z.string().max(MAX_DOCUMENT_BYTES),
    })
    .strict(),
  z
    .object({
      file: z.string().min(1),
      label: z.string(),
      medium: z.literal('html'),
      body: z.string().max(MAX_DOCUMENT_BYTES),
    })
    .strict(),
])

export type ReviewDoc = z.infer<typeof reviewDocSchema>
export const reviewIntentOutputSchema = z.array(reviewDocSchema).max(MAX_DOCUMENTS)

/* Evidence descriptors */

/**
 * A descriptor names a plain file inside the evidence directory — never a traversal, a nested
 * path, a dotfile, or an absolute path. This is the containment rule the daemon already
 * enforces when it lists and reads evidence bytes.
 */
const evidenceFileNameSchema = z
  .string()
  .min(1)
  .refine(
    (value) => !value.includes('/') && !value.includes('\\') && !value.startsWith('.'),
    'must be a plain file name inside the evidence directory',
  )

const unavailableShape = {
  state: z.literal('unavailable'),
  reason: z.literal('too-large'),
  maxBytes: z.number().int().positive(),
} as const

const safeExternalUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:'
  }, 'must use http, https, or mailto')

export const evidenceDocDescriptorSchema = z.discriminatedUnion('state', [
  z
    .object({
      file: evidenceFileNameSchema,
      label: z.string(),
      medium: z.enum(['markdown', 'html']),
      bytes: z.number().int().nonnegative(),
      state: z.literal('available'),
    })
    .strict(),
  z
    .object({
      file: evidenceFileNameSchema,
      label: z.string(),
      medium: z.enum(['markdown', 'html']),
      bytes: z.number().int().nonnegative(),
      ...unavailableShape,
    })
    .strict(),
])

export type EvidenceDocDescriptor = z.infer<typeof evidenceDocDescriptorSchema>

const evidenceMediaDescriptorSchema = z.discriminatedUnion('state', [
  z
    .object({
      file: evidenceFileNameSchema,
      label: z.string(),
      kind: z.enum(['image', 'video']),
      mime: z.string(),
      bytes: z.number().int().nonnegative(),
      state: z.literal('available'),
    })
    .strict(),
  z
    .object({
      file: evidenceFileNameSchema,
      label: z.string(),
      kind: z.enum(['image', 'video']),
      mime: z.string(),
      bytes: z.number().int().nonnegative(),
      ...unavailableShape,
    })
    .strict(),
])

const evidenceLinkDescriptorSchema = z
  .object({
    file: evidenceFileNameSchema,
    label: z.string(),
    kind: z.literal('link'),
    href: safeExternalUrlSchema,
    bytes: z.number().int().nonnegative(),
    state: z.literal('available'),
  })
  .strict()

export const evidenceAssetDescriptorSchema = z.union([
  evidenceMediaDescriptorSchema,
  evidenceLinkDescriptorSchema,
])

export type EvidenceAssetDescriptor = z.infer<typeof evidenceAssetDescriptorSchema>

/**
 * The one Evidence aggregate: checks plus descriptors. Bodies are fetched on demand, so no
 * document text and no asset bytes travel here. A pack exists when any of checks, results, or
 * assets is non-empty; the output is `null` when there is no pack at all.
 */
export const reviewEvidenceSchema = z
  .object({
    title: z.string(),
    updatedAt: z.string(),
    checks: z.array(evidenceCheckSchema).max(MAX_CHECKS),
    results: z.array(evidenceDocDescriptorSchema).max(MAX_DOCUMENTS),
    assets: z.array(evidenceAssetDescriptorSchema).max(MAX_ASSETS),
  })
  .strict()

export const reviewEvidenceOutputSchema = reviewEvidenceSchema.nullable()
export type ReviewEvidence = z.infer<typeof reviewEvidenceSchema>
export type ReviewEvidenceOutput = z.infer<typeof reviewEvidenceOutputSchema>

export const evidenceAssetBodySchema = z
  .object({
    file: evidenceFileNameSchema,
    mime: z.string(),
    bytes: z.number().max(MAX_ASSET_BYTES),
    dataUrl: z.string(),
  })
  .strict()

export type EvidenceAssetBody = z.infer<typeof evidenceAssetBodySchema>

/* Comments and reviewed marks */

export const reviewCommentAnchorSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('file'),
      path: z.string().min(1),
      startLine: z.number().int().positive().optional(),
      endLine: z.number().int().positive().optional(),
      anchorText: z.string().optional(),
    })
    .strict()
    .superRefine((anchor, context) => {
      if (
        anchor.startLine !== undefined &&
        anchor.endLine !== undefined &&
        anchor.endLine < anchor.startLine
      ) {
        context.addIssue({ code: 'custom', message: 'endLine must not precede startLine' })
      }
    }),
  z
    .object({
      kind: z.literal('canvas'),
      canvasId: z.string().min(1),
      section: z.string().min(1).optional(),
    })
    .strict(),
  z.object({ kind: z.literal('changeset') }).strict(),
])
export type ReviewCommentAnchor = z.infer<typeof reviewCommentAnchorSchema>

export const reviewCommentSchema = z
  .object({
    id: z.string(),
    /** Absent only for comments written before authorship was recorded; clients treat those as user. */
    author: z.enum(['user', 'agent']).optional(),
    /** Legacy file fields remain readable while new comments use `anchor`. */
    path: z.string().min(1).optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    anchorText: z.string().optional(),
    anchor: reviewCommentAnchorSchema.optional(),
    body: z.string(),
    resolved: z.boolean(),
    createdAt: z.number(),
    agentReply: z.object({ body: z.string(), createdAt: z.number() }).strict().optional(),
  })
  .strict()
  .superRefine((comment, context) => {
    if (comment.anchor === undefined && comment.path === undefined) {
      context.addIssue({ code: 'custom', message: 'comment needs an anchor' })
    }
  })

export type ReviewComment = z.infer<typeof reviewCommentSchema>

/** Daemon-observed Review readiness; axes stay independent so live and History states do not blur. */
export const reviewReadinessScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('working') }).strict(),
  z.object({ type: z.literal('range'), base: z.string().min(1).optional() }).strict(),
  z.object({ type: z.literal('commit'), hash: z.string().regex(/^[0-9a-f]{7,64}$/) }).strict(),
])
export const reviewReadinessInputSchema = z
  .object({ repoPath: z.string().min(1), scope: reviewReadinessScopeSchema })
  .strict()
export const reviewReadinessOutputSchema = z
  .object({
    freshness: z.enum(['absent', 'current', 'stale', 'unavailable']),
    binding: z.enum(['none', 'live', 'commit', 'unbound']),
    canvas: z
      .object({ id: z.string().min(1), commitHash: z.string().min(1).optional() })
      .nullable(),
    coverage: z
      .object({
        changedFileCount: z.number().int().nonnegative(),
        orderedFileCount: z.number().int().nonnegative(),
        missingPaths: z.array(z.string()),
        missingCount: z.number().int().nonnegative(),
      })
      .strict(),
    evidence: z
      .object({
        checks: z.number().int().nonnegative(),
        passed: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        assets: z.number().int().nonnegative(),
      })
      .strict(),
    /** A selected Review record existed but could not be read; never present on a truthful absence. */
    issue: z.enum(['unavailable']).optional(),
  })
  .strict()
export type ReviewReadinessInput = z.infer<typeof reviewReadinessInputSchema>
export type ReviewReadinessOutput = z.infer<typeof reviewReadinessOutputSchema>

/** Total: sets exactly `paths` to `reviewed`, so one bulk write stays one atomic call. */
export const setReviewedInputSchema = z
  .object({
    repoPath: z.string().min(1),
    paths: z.array(z.string().min(1)).min(1),
    reviewed: z.boolean(),
  })
  .strict()
export type SetReviewedInput = z.infer<typeof setReviewedInputSchema>

export const addReviewCommentInputSchema = z
  .object({
    repoPath: z.string().min(1),
    path: z.string().min(1).optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    anchorText: z.string().optional(),
    anchor: reviewCommentAnchorSchema.optional(),
    body: z.string().min(1),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.anchor === undefined && input.path === undefined) {
      context.addIssue({ code: 'custom', message: 'comment needs an anchor' })
    }
  })
export type AddReviewCommentInput = z.infer<typeof addReviewCommentInputSchema>

export const editReviewCommentInputSchema = z
  .object({ repoPath: z.string().min(1), id: z.string().min(1), body: z.string().min(1) })
  .strict()
export type EditReviewCommentInput = z.infer<typeof editReviewCommentInputSchema>

export const deleteReviewCommentInputSchema = z
  .object({ repoPath: z.string().min(1), id: z.string().min(1) })
  .strict()
export type DeleteReviewCommentInput = z.infer<typeof deleteReviewCommentInputSchema>

export const clearResolvedReviewCommentsInputSchema = z
  .object({ repoPath: z.string().min(1) })
  .strict()
export type ClearResolvedReviewCommentsInput = z.infer<
  typeof clearResolvedReviewCommentsInputSchema
>

export const resolveReviewCommentInputSchema = z
  .object({ repoPath: z.string().min(1), id: z.string().min(1), resolved: z.boolean() })
  .strict()
export type ResolveReviewCommentInput = z.infer<typeof resolveReviewCommentInputSchema>

/* Inputs and the void output */

export const repoPathInputSchema = z.string().min(1)
export type RepoPathInput = z.infer<typeof repoPathInputSchema>

export const reviewEvidenceDocInputSchema = z
  .object({ repoPath: z.string().min(1), file: z.string().min(1) })
  .strict()
export type ReviewEvidenceDocInput = z.infer<typeof reviewEvidenceDocInputSchema>

export const reviewEvidenceAssetInputSchema = z
  .object({ repoPath: z.string().min(1), file: z.string().min(1) })
  .strict()
export type ReviewEvidenceAssetInput = z.infer<typeof reviewEvidenceAssetInputSchema>

export const voidOutputSchema = z.void()
export type VoidOutput = z.infer<typeof voidOutputSchema>
