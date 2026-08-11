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
  /**
   * @deprecated Evidence is three sub-tabs, not one medium. Still required here
   * because the daemon still emits it; relax to `.optional()` only once the
   * daemon stops.
   */
  medium: z.literal('html'),
  /** Documents in `evidence/results/` — how many tabs Results will have. */
  results: z.number().optional(),
  /** Images in `evidence/assets/` — how many tiles the gallery will have. */
  assets: z.number().optional(),
  /** A legacy `index.html` is present, folded into Results as "Report". */
  hasReport: z.boolean().optional(),
})

/** A gallery tile as the Assets sub-tab lists it — everything but the bytes. */
const evidenceAssetSchema = z.object({
  file: z.string(),
  label: z.string(),
  kind: z.literal('image'),
  mime: z.string(),
  bytes: z.number(),
})

/**
 * One gallery image, fetched on demand. A data URL rather than a URL: the daemon
 * serves no user files over HTTP, so the bytes ride the authenticated channel
 * like every other read. `null` from the procedure means over the daemon's cap.
 */
const evidenceAssetBodySchema = z.object({
  file: z.string(),
  mime: z.string(),
  bytes: z.number(),
  dataUrl: z.string(),
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
  // A canvas in a medium this client cannot draw — a scene from a daemon older than
  // the HTML + Markdown collapse — reads as no canvas rather than failing the Review.
  canvas: canvasSchema.optional().catch(undefined),
  evidence: evidenceMetaSchema.nullable(),
})

/**
 * Intent (and extra Evidence) documents: `.porcelain/intent/` and the files beside
 * `evidence/index.html`, rendered as ordered tabs.
 *
 * Discriminated on `medium` because each one is a different kind of thing, not a different
 * flavour of string: markdown is rendered to HTML here, and an HTML document arrives already
 * self-contained (the daemon inlines its siblings). Those two are the whole media story on
 * every client.
 */
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
])

/**
 * A document in a medium this client has no renderer for — a scene left by a daemon older
 * than the HTML + Markdown collapse — is dropped from the strip, never allowed to fail the
 * whole tab set.
 */
const intentDocsSchema = z
  .array(intentDocSchema.nullable().catch(null))
  .transform((docs) => docs.filter((doc) => doc !== null))

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
export type EvidenceAsset = z.infer<typeof evidenceAssetSchema>
export type EvidenceAssetBody = z.infer<typeof evidenceAssetBodySchema>
export type IntentDoc = z.infer<typeof intentDocSchema>
export type PublishCost = z.infer<typeof publishCostSchema>
export type PublishResult = z.infer<typeof publishResultSchema>
export type ArchivedReview = z.infer<typeof archivedReviewSchema>

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
export const reviewIntentQuery = defineQuery<string, IntentDoc[]>('reviewIntent', intentDocsSchema)

/**
 * The Results sub-tab of Evidence: `evidence/results/` as a document set, with a
 * legacy `evidence/index.html` folded in first as "Report". Same media, same
 * caps, same lazy rule as Intent — the name is wire history from when it meant
 * "the extra documents beside index.html".
 */
export const reviewEvidenceDocsQuery = defineQuery<string, IntentDoc[]>(
  'reviewEvidenceDocs',
  intentDocsSchema,
)

/** The Assets sub-tab: `evidence/assets/` listed as a gallery. Metadata only. */
export const reviewEvidenceAssetsQuery = defineQuery<string, EvidenceAsset[]>(
  'reviewEvidenceAssets',
  z.array(evidenceAssetSchema),
)

/**
 * One gallery image. A pack runs to megabytes, so this is asked per tile and only
 * while the Assets sub-tab is up — never for the gallery as a whole.
 */
export const reviewEvidenceAssetQuery = defineQuery<
  { repoPath: string; file: string },
  EvidenceAssetBody | null
>('reviewEvidenceAsset', evidenceAssetBodySchema.nullable())

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
