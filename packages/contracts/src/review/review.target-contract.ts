import { z } from 'zod'
import { diffHunkSchema, fileStatusSchema } from '../git'

/**
 * Target-v1 Review models (REV-001).
 *
 * Inactive by construction: nothing here is exported from `./index.ts`, composed into
 * `procedure-catalog.ts`, or reachable from a router, so no runtime caller can select
 * between two wires. REV-009 folds the surviving names into `review.contract.ts` and
 * deletes this file in the same cutover commit.
 *
 * Every export is prefixed `target` so both vocabularies can coexist until then.
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

export const targetFileSourceSchema = z.enum(['changed', 'context', 'shipped'])
export type TargetFileSource = z.infer<typeof targetFileSourceSchema>

export const targetSliceRangeSchema = z
  .object({
    startLine: z.number().int().positive(),
    lines: z.array(z.string()),
    gapBefore: z.number().int().nonnegative(),
  })
  .strict()

export type TargetSliceRange = z.infer<typeof targetSliceRangeSchema>

export const targetReadingFileSchema = z
  .object({
    path: z.string().min(1),
    source: targetFileSourceSchema,
    note: z.string().optional(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    status: fileStatusSchema.optional(),
    hunks: z.array(diffHunkSchema).optional(),
    ranges: z.array(targetSliceRangeSchema).optional(),
    truncated: z.boolean().optional(),
    whole: z.boolean().optional(),
  })
  .strict()

export type TargetReadingFile = z.infer<typeof targetReadingFileSchema>

export const targetReadingGroupSchema = z
  .object({
    layer: z.string(),
    files: z.array(targetReadingFileSchema),
  })
  .strict()

export type TargetReadingGroup = z.infer<typeof targetReadingGroupSchema>

export const targetReviewSectionSchema = z
  .object({
    title: z.string().min(1).max(MAX_SECTION_TITLE),
    prose: z.string().max(MAX_SECTION_PROSE),
    diagram: z.string().max(MAX_SECTION_DIAGRAM).optional(),
    html: z.string().max(MAX_SECTION_HTML).optional(),
    htmlHeight: z.number().int().min(160).max(1600).optional(),
    files: z.array(targetReadingFileSchema),
  })
  .strict()

export type TargetReviewSection = z.infer<typeof targetReviewSectionSchema>

const targetSectionOutlineSchema = z
  .object({
    title: z.string().min(1).max(MAX_SECTION_TITLE),
    anchorCount: z.number().int().min(0).max(40),
  })
  .strict()

/* Active review */

export const targetActiveReviewSchema = z
  .object({
    name: z.string(),
    fromAgent: z.boolean(),
    thesis: z.string().max(MAX_THESIS).optional(),
    sections: z.array(targetSectionOutlineSchema).max(MAX_SECTIONS),
    groups: z.array(targetReadingGroupSchema),
  })
  .strict()

/** `null` is "no active review"; an object with empty `groups` is an empty one. */
export const targetActiveReviewOutputSchema = targetActiveReviewSchema.nullable()
export type TargetActiveReview = z.infer<typeof targetActiveReviewSchema>
export type TargetActiveReviewOutput = z.infer<typeof targetActiveReviewOutputSchema>

/* Reading */

export const targetEvidenceCheckSchema = z
  .object({
    label: z.string().min(1).max(MAX_CHECK_LABEL),
    status: z.enum(['pass', 'fail', 'skip']),
    detail: z.string().max(MAX_CHECK_DETAIL).optional(),
  })
  .strict()

export type TargetEvidenceCheck = z.infer<typeof targetEvidenceCheckSchema>

export const targetReviewReadingEvidenceSchema = z
  .object({
    title: z.string(),
    updatedAt: z.string(),
    checks: z.array(targetEvidenceCheckSchema).max(MAX_CHECKS),
  })
  .strict()

export const targetReviewReadingSchema = z
  .object({
    name: z.string(),
    thesis: z.string().max(MAX_THESIS).optional(),
    sections: z.array(targetReviewSectionSchema).max(MAX_SECTIONS),
    groups: z.array(targetReadingGroupSchema),
    evidence: targetReviewReadingEvidenceSchema.nullable(),
  })
  .strict()

export const targetReviewReadingOutputSchema = targetReviewReadingSchema.nullable()
export type TargetReviewReading = z.infer<typeof targetReviewReadingSchema>
export type TargetReviewReadingOutput = z.infer<typeof targetReviewReadingOutputSchema>

/* Documents — Intent and Evidence Results share the primitive */

export const targetReviewDocSchema = z.discriminatedUnion('medium', [
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

export type TargetReviewDoc = z.infer<typeof targetReviewDocSchema>
export const targetReviewIntentOutputSchema = z.array(targetReviewDocSchema).max(MAX_DOCUMENTS)

/* Evidence descriptors */

/**
 * A descriptor names a plain file inside the evidence directory — never a traversal, a nested
 * path, a dotfile, or an absolute path. This is the containment rule the daemon already
 * enforces when it lists and reads evidence bytes.
 */
const targetEvidenceFileNameSchema = z
  .string()
  .min(1)
  .refine(
    (value) => !value.includes('/') && !value.includes('\\') && !value.startsWith('.'),
    'must be a plain file name inside the evidence directory',
  )

const targetUnavailableShape = {
  state: z.literal('unavailable'),
  reason: z.literal('too-large'),
  maxBytes: z.number().int().positive(),
} as const

export const targetEvidenceDocDescriptorSchema = z.discriminatedUnion('state', [
  z
    .object({
      file: targetEvidenceFileNameSchema,
      label: z.string(),
      medium: z.enum(['markdown', 'html']),
      bytes: z.number().int().nonnegative(),
      state: z.literal('available'),
    })
    .strict(),
  z
    .object({
      file: targetEvidenceFileNameSchema,
      label: z.string(),
      medium: z.enum(['markdown', 'html']),
      bytes: z.number().int().nonnegative(),
      ...targetUnavailableShape,
    })
    .strict(),
])

export type TargetEvidenceDocDescriptor = z.infer<typeof targetEvidenceDocDescriptorSchema>

export const targetEvidenceAssetDescriptorSchema = z.discriminatedUnion('state', [
  z
    .object({
      file: targetEvidenceFileNameSchema,
      label: z.string(),
      kind: z.literal('image'),
      mime: z.string(),
      bytes: z.number().int().nonnegative(),
      state: z.literal('available'),
    })
    .strict(),
  z
    .object({
      file: targetEvidenceFileNameSchema,
      label: z.string(),
      kind: z.literal('image'),
      mime: z.string(),
      bytes: z.number().int().nonnegative(),
      ...targetUnavailableShape,
    })
    .strict(),
])

export type TargetEvidenceAssetDescriptor = z.infer<typeof targetEvidenceAssetDescriptorSchema>

/**
 * The one Evidence aggregate: checks plus descriptors. Bodies are fetched on demand, so no
 * document text and no asset bytes travel here. A pack exists when any of checks, results, or
 * assets is non-empty; the output is `null` when there is no pack at all.
 */
export const targetReviewEvidenceSchema = z
  .object({
    title: z.string(),
    updatedAt: z.string(),
    checks: z.array(targetEvidenceCheckSchema).max(MAX_CHECKS),
    results: z.array(targetEvidenceDocDescriptorSchema).max(MAX_DOCUMENTS),
    assets: z.array(targetEvidenceAssetDescriptorSchema).max(MAX_ASSETS),
  })
  .strict()

export const targetReviewEvidenceOutputSchema = targetReviewEvidenceSchema.nullable()
export type TargetReviewEvidence = z.infer<typeof targetReviewEvidenceSchema>
export type TargetReviewEvidenceOutput = z.infer<typeof targetReviewEvidenceOutputSchema>

export const targetEvidenceAssetBodySchema = z
  .object({
    file: targetEvidenceFileNameSchema,
    mime: z.string(),
    bytes: z.number().max(MAX_ASSET_BYTES),
    dataUrl: z.string(),
  })
  .strict()

export type TargetEvidenceAssetBody = z.infer<typeof targetEvidenceAssetBodySchema>

/* Lifecycle and archive */

export const targetPublishCostSchema = z.object({ bytes: z.number(), files: z.number() }).strict()
export type TargetPublishCost = z.infer<typeof targetPublishCostSchema>

export const targetPublishResultSchema = z
  .object({ id: z.string(), cost: targetPublishCostSchema })
  .strict()
export type TargetPublishResult = z.infer<typeof targetPublishResultSchema>

export const targetArchivedReviewSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    thesis: z.string().max(MAX_THESIS).optional(),
    archivedAt: z.string(),
  })
  .strict()

export type TargetArchivedReview = z.infer<typeof targetArchivedReviewSchema>

/* Comments */

export const targetReviewCommentSchema = z
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

export type TargetReviewComment = z.infer<typeof targetReviewCommentSchema>

/* Inbox */

export const targetReviewInboxRowSchema = z
  .object({
    path: z.string(),
    branch: z.string(),
    changedCount: z.number(),
    hasReview: z.boolean(),
  })
  .strict()

export type TargetReviewInboxRow = z.infer<typeof targetReviewInboxRowSchema>

/* Inputs and the void output */

export const targetRepoPathInputSchema = z.string().min(1)
export type TargetRepoPathInput = z.infer<typeof targetRepoPathInputSchema>

/** Total: sets exactly `paths` to `reviewed`, so one bulk write stays one atomic call. */
export const targetSetReviewedInputSchema = z
  .object({
    repoPath: z.string().min(1),
    paths: z.array(z.string().min(1)).min(1),
    reviewed: z.boolean(),
  })
  .strict()
export type TargetSetReviewedInput = z.infer<typeof targetSetReviewedInputSchema>

export const targetExploreReadingInputSchema = z
  .object({
    repoPath: z.string().min(1),
    seed: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('file'), path: z.string().min(1) }).strict(),
      z
        .object({ kind: z.literal('symbol'), path: z.string().min(1), symbol: z.string().min(1) })
        .strict(),
    ]),
  })
  .strict()
export type TargetExploreReadingInput = z.infer<typeof targetExploreReadingInputSchema>

export const targetReviewEvidenceDocInputSchema = z
  .object({ repoPath: z.string().min(1), file: z.string().min(1) })
  .strict()
export type TargetReviewEvidenceDocInput = z.infer<typeof targetReviewEvidenceDocInputSchema>

export const targetReviewEvidenceAssetInputSchema = z
  .object({ repoPath: z.string().min(1), file: z.string().min(1) })
  .strict()
export type TargetReviewEvidenceAssetInput = z.infer<typeof targetReviewEvidenceAssetInputSchema>

export const targetArchivedReviewIdInputSchema = z
  .object({ repoPath: z.string().min(1), id: z.string().min(1) })
  .strict()
export type TargetArchivedReviewIdInput = z.infer<typeof targetArchivedReviewIdInputSchema>

export const targetAddReviewCommentInputSchema = z
  .object({
    repoPath: z.string().min(1),
    path: z.string().min(1),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    anchorText: z.string().optional(),
    body: z.string().min(1),
  })
  .strict()
export type TargetAddReviewCommentInput = z.infer<typeof targetAddReviewCommentInputSchema>

export const targetEditReviewCommentInputSchema = z
  .object({ repoPath: z.string().min(1), id: z.string().min(1), body: z.string().min(1) })
  .strict()
export type TargetEditReviewCommentInput = z.infer<typeof targetEditReviewCommentInputSchema>

export const targetDeleteReviewCommentInputSchema = z
  .object({ repoPath: z.string().min(1), id: z.string().min(1) })
  .strict()
export type TargetDeleteReviewCommentInput = z.infer<typeof targetDeleteReviewCommentInputSchema>

export const targetClearResolvedReviewCommentsInputSchema = z
  .object({ repoPath: z.string().min(1) })
  .strict()
export type TargetClearResolvedReviewCommentsInput = z.infer<
  typeof targetClearResolvedReviewCommentsInputSchema
>

export const targetResolveReviewCommentInputSchema = z
  .object({ repoPath: z.string().min(1), id: z.string().min(1), resolved: z.boolean() })
  .strict()
export type TargetResolveReviewCommentInput = z.infer<typeof targetResolveReviewCommentInputSchema>

export const targetVoidOutputSchema = z.void()
export type TargetVoidOutput = z.infer<typeof targetVoidOutputSchema>
