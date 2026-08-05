import { z } from 'zod'

import { defineMutation, defineQuery } from '../procedure'

const fileSourceSchema = z.enum(['changed', 'context', 'shipped'])
const fileStatusSchema = z.enum(['modified', 'added', 'deleted', 'renamed', 'untracked'])

const diffLineSchema = z.object({
  kind: z.enum(['context', 'add', 'del']),
  oldLine: z.number().nullable(),
  newLine: z.number().nullable(),
  text: z.string(),
})

const diffHunkSchema = z.object({
  header: z.string(),
  lines: z.array(diffLineSchema),
})

const sliceRangeSchema = z.object({
  startLine: z.number(),
  lines: z.array(z.string()),
  gapBefore: z.number(),
})

const readingFileSchema = z.object({
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

const featureFileSchema = z.object({
  path: z.string(),
  source: fileSourceSchema,
  status: fileStatusSchema.optional(),
  note: z.string().optional(),
  layer: z.string().optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  connects: z.array(z.string()),
})

const featureGroupSchema = z.object({
  layer: z.string(),
  files: z.array(featureFileSchema),
})

const sectionOutlineSchema = z.object({
  title: z.string(),
  anchorCount: z.number(),
})

const featureViewObjectSchema = z.object({
  name: z.string(),
  fromAgent: z.boolean(),
  thesis: z.string().optional(),
  sections: z.array(sectionOutlineSchema),
  groups: z.array(featureGroupSchema),
})
const featureViewSchema = featureViewObjectSchema.nullable()

const evidenceCheckSchema = z.object({
  label: z.string(),
  status: z.enum(['pass', 'fail', 'skip']),
  detail: z.string().optional(),
})

const evidenceMetaSchema = z.object({
  title: z.string(),
  updatedAt: z.string(),
  checks: z.array(evidenceCheckSchema),
  dir: z.string().optional(),
  medium: z.literal('html'),
})

const evidenceSchema = evidenceMetaSchema.extend({
  html: z.string().optional(),
  htmlUnavailable: z
    .object({
      reason: z.literal('too-large'),
      bytes: z.number(),
      maxBytes: z.number(),
    })
    .optional(),
})

const canvasSchema = z.discriminatedUnion('medium', [
  z.object({ medium: z.literal('html'), html: z.string() }),
  z.object({
    medium: z.literal('excalidraw'),
    scene: z.object({ elements: z.array(z.unknown()) }).passthrough(),
  }),
])

const featureReadingSchema = z.object({
  name: z.string(),
  thesis: z.string().optional(),
  sections: z.array(
    z.object({
      title: z.string(),
      prose: z.string(),
      diagram: z.string().optional(),
      html: z.string().optional(),
      htmlHeight: z.number().optional(),
      files: z.array(readingFileSchema),
    }),
  ),
  groups: z.array(
    z.object({
      layer: z.string(),
      files: z.array(readingFileSchema),
    }),
  ),
  canvas: canvasSchema.optional(),
  evidence: evidenceMetaSchema.nullable(),
})

const reviewCommentSchema = z.object({
  id: z.string(),
  path: z.string(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
  anchorText: z.string().optional(),
  body: z.string(),
  resolved: z.boolean(),
  createdAt: z.number(),
  agentReply: z
    .object({
      body: z.string(),
      createdAt: z.number(),
    })
    .optional(),
})

const boardCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  status: z.enum(['todo', 'doing', 'done']),
  order: z.number(),
  createdAt: z.number(),
})

export type FeatureView = z.infer<typeof featureViewObjectSchema>
export type FeatureViewSummary = { name: string } | null
export type ReadingFile = z.infer<typeof readingFileSchema>
export type FeatureReading = z.infer<typeof featureReadingSchema>
export type EvidenceMeta = z.infer<typeof evidenceMetaSchema>
export type Evidence = z.infer<typeof evidenceSchema>
export type ReviewComment = z.infer<typeof reviewCommentSchema>
export type BoardCard = z.infer<typeof boardCardSchema>
export type CardStatus = BoardCard['status']

export const featureViewQuery = defineQuery<string, FeatureView | null>(
  'featureView',
  featureViewSchema,
)

export const featureReadingQuery = defineQuery<string, FeatureReading | null>(
  'featureReading',
  featureReadingSchema.nullable(),
)

export const loopEvidenceQuery = defineQuery<string, EvidenceMeta | null>(
  'loopEvidence',
  evidenceMetaSchema.nullable(),
)

export const loopEvidenceHtmlQuery = defineQuery<string, Evidence | null>(
  'loopEvidenceHtml',
  evidenceSchema.nullable(),
)

export const reviewCommentsQuery = defineQuery<string, ReviewComment[]>(
  'reviewComments',
  z.array(reviewCommentSchema),
)

/**
 * A comment with no `startLine` is anchored to the whole file; with one it anchors to a line
 * range on the NEW side of the diff. `anchorText` is the quoted source the agent sees when the
 * lines have since moved.
 */
export const addReviewCommentMutation = defineMutation<
  {
    repoPath: string
    path: string
    body: string
    startLine?: number
    endLine?: number
    anchorText?: string
  },
  ReviewComment
>('addReviewComment', reviewCommentSchema)

export const editReviewCommentMutation = defineMutation<
  { repoPath: string; id: string; body: string },
  void
>('editReviewComment', z.void())

export const deleteReviewCommentMutation = defineMutation<{ repoPath: string; id: string }, void>(
  'deleteReviewComment',
  z.void(),
)

export const resolveReviewCommentMutation = defineMutation<
  { repoPath: string; id: string; resolved: boolean },
  void
>('resolveReviewComment', z.void())

/** Bulk delete of every resolved comment — open ones are left alone. Not recoverable. */
export const clearResolvedReviewCommentsMutation = defineMutation<{ repoPath: string }, void>(
  'clearResolvedReviewComments',
  z.void(),
)

export const boardCardsQuery = defineQuery<string, BoardCard[]>(
  'boardCards',
  z.array(boardCardSchema),
)

export const addBoardCardMutation = defineMutation<
  { repoPath: string; title: string; body?: string; status?: CardStatus },
  BoardCard
>('addBoardCard', boardCardSchema)

export const updateBoardCardMutation = defineMutation<
  { repoPath: string; id: string; title?: string; body?: string },
  void
>('updateBoardCard', z.void())

export const moveBoardCardMutation = defineMutation<
  { repoPath: string; id: string; status: CardStatus },
  void
>('moveBoardCard', z.void())

export const deleteBoardCardMutation = defineMutation<{ repoPath: string; id: string }, void>(
  'deleteBoardCard',
  z.void(),
)

export const clearBoardCardsMutation = defineMutation<
  { repoPath: string; status: CardStatus },
  void
>('clearBoardCards', z.void())
