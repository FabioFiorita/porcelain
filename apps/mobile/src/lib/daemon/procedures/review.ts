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

/**
 * Intent (and extra Evidence) documents: `.porcelain/intent/` and the files beside
 * `evidence/index.html`, rendered as ordered tabs.
 *
 * Discriminated on `medium` because each one is a different kind of thing, not a different
 * flavour of string: markdown is rendered to HTML here, an HTML document arrives already
 * self-contained (the daemon inlines its siblings), and an Excalidraw scene is inert JSON
 * that only the desktop canvas can draw. The scene is carried but not walked — this client
 * has no canvas host, so a mobile reader is told to open it on the desktop rather than shown
 * a blank pane.
 */
const intentSceneSchema = z.object({ elements: z.array(z.unknown()) }).passthrough()

const intentDocSchema = z.discriminatedUnion('medium', [
  z.object({
    file: z.string(),
    label: z.string(),
    medium: z.literal('markdown'),
    body: z.string(),
  }),
  z.object({
    file: z.string(),
    label: z.string(),
    medium: z.literal('html'),
    body: z.string(),
  }),
  z.object({
    file: z.string(),
    label: z.string(),
    medium: z.literal('excalidraw'),
    scene: intentSceneSchema,
  }),
])

const publishCostSchema = z.object({ bytes: z.number(), files: z.number() })

const publishResultSchema = z.object({ id: z.string(), cost: publishCostSchema })

const archivedReviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  thesis: z.string().optional(),
  archivedAt: z.string(),
})

export type FeatureView = z.infer<typeof featureViewObjectSchema>
export type FeatureViewSummary = { name: string } | null
export type FileSource = z.infer<typeof fileSourceSchema>
export type ReadingFile = z.infer<typeof readingFileSchema>
export type SliceRange = z.infer<typeof sliceRangeSchema>
export type FeatureReading = z.infer<typeof featureReadingSchema>
export type EvidenceMeta = z.infer<typeof evidenceMetaSchema>
export type EvidenceCheck = z.infer<typeof evidenceCheckSchema>
export type Evidence = z.infer<typeof evidenceSchema>
export type IntentDoc = z.infer<typeof intentDocSchema>
export type PublishCost = z.infer<typeof publishCostSchema>
export type PublishResult = z.infer<typeof publishResultSchema>
export type ArchivedReview = z.infer<typeof archivedReviewSchema>
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

/**
 * Intent as a document set. Up to 8 MiB of documents across the tabs, so this is only ever
 * read while the Intent canvas is on screen — never alongside `featureReading`, and never on
 * a poll.
 */
export const reviewIntentQuery = defineQuery<string, IntentDoc[]>(
  'reviewIntent',
  z.array(intentDocSchema),
)

/** Extra evidence documents beside `index.html` — same media, same caps, same lazy rule. */
export const reviewEvidenceDocsQuery = defineQuery<string, IntentDoc[]>(
  'reviewEvidenceDocs',
  z.array(intentDocSchema),
)

/** Byte cost of publishing the active review, so the warning can name a real number. */
export const reviewPublishCostQuery = defineQuery<string, PublishCost>(
  'reviewPublishCost',
  publishCostSchema,
)

/**
 * Archive the active review and force-stage it for the team, past the ignore rule that keeps
 * reviews local. `null` when there was nothing active to publish. Staging only — the commit
 * stays the human's.
 */
export const publishReviewMutation = defineMutation<string, PublishResult | null>(
  'publishReview',
  publishResultSchema.nullable(),
)

/** Previous (archived) reviews for the project, newest first. */
export const archivedReviewsQuery = defineQuery<string, ArchivedReview[]>(
  'archivedReviews',
  z.array(archivedReviewSchema),
)

/** Promote an archive back to active. Archives whatever is active first. */
export const restoreArchivedReviewMutation = defineMutation<{ repoPath: string; id: string }, void>(
  'restoreArchivedReview',
  z.void(),
)

/** Permanently delete an archived review. Not recoverable. */
export const deleteArchivedReviewMutation = defineMutation<{ repoPath: string; id: string }, void>(
  'deleteArchivedReview',
  z.void(),
)

/**
 * Archive the active review — intent, walkthrough, comments, reviewed marks and evidence —
 * under `.porcelain/reviews/<id>/` and clear the active slots.
 */
export const clearFeatureReviewMutation = defineMutation<string, void>(
  'clearFeatureReview',
  z.void(),
)

/** Drop the loop evidence without touching the rest of the review. */
export const clearLoopEvidenceMutation = defineMutation<string, void>('clearLoopEvidence', z.void())

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
