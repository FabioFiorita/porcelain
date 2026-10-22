import { isoDateTimeSchema } from '../shared/schema.ts';
import { utf8ByteLength } from '../shared/utf8-byte-length.ts';
import { Schema, SchemaTransformation } from 'effect';
import { nullableAsUndefined } from '../shared/schema.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import {
  CHANGED_PATHS,
  DIAGRAM_ARROWS,
  DIAGRAM_BOXES,
  LINE_NUMBER_MAX,
  REVIEW_LABEL_LENGTH,
  REVIEW_LANES,
  REVIEW_LANE_NAME_LENGTH,
  REVIEW_LAYERS,
  REVIEW_PROSE_LENGTH,
  REVIEW_STEPS,
  REVIEW_STEP_TEXT_LENGTH,
  REVIEW_SUMMARY_BYTES,
  REVIEW_SUMMARY_MEBIBYTES,
  REVIEW_SYMBOL_LENGTH,
  REVIEW_TITLE_LENGTH,
} from '../shared/limits.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { proofDraftSchema, publishedProofSchema } from './review-proof.ts';
import { reviewSummaryLinkSchema } from './review-summary-link.ts';
import { readBranchDiffsRequestSchema } from '../changes/branch-changes.ts';
import { worktreeIdSchema } from '../shared/schema.ts';

const idSchema = Schema.String.check(Schema.isUUID());
const lineSchema = Schema.Number.check(Schema.isInt())
  .check(Schema.isGreaterThanOrEqualTo(1))
  .check(Schema.isLessThanOrEqualTo(LINE_NUMBER_MAX));

const codePointerSchema = Schema.Struct({
  path: relativePathSchema,
  startLine: lineSchema,
  endLine: lineSchema,
  symbol: Schema.optional(
    Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))
      .check(Schema.isMinLength(1))
      .check(Schema.isMaxLength(REVIEW_SYMBOL_LENGTH)),
  ),
});

const resolvedCodePointerSchema = Schema.Struct({
  ...codePointerSchema.fields,
  ...{
    textFingerprint: fingerprintSchema,
  },
});

const stepLocationSchema = Schema.Union([
  Schema.Struct({ state: Schema.Literal('changed') }),
  Schema.Struct({ state: Schema.Literal('broken') }),
  Schema.Struct({
    state: Schema.Literal('current'),
    startLine: lineSchema,
    endLine: lineSchema,
  }),
  Schema.Struct({
    state: Schema.Literal('committed'),
    startLine: lineSchema,
    endLine: lineSchema,
  }),
]);

const reviewStepSchema = Schema.Struct({
  id: idSchema,
  lane: Schema.Number.check(Schema.isInt())
    .check(Schema.isGreaterThanOrEqualTo(0))
    .check(Schema.isLessThanOrEqualTo(REVIEW_LANES - 1)),
  title: Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(REVIEW_TITLE_LENGTH)),
  text: Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(REVIEW_STEP_TEXT_LENGTH)),
  kind: Schema.Literals(['changed', 'context']),
  pointer: codePointerSchema,
});

const resolvedReviewStepSchema = Schema.Struct({
  published: Schema.optional(Schema.Array(Schema.String)),
  ...reviewStepSchema.fields,
  ...{
    pointer: resolvedCodePointerSchema,
    location: stepLocationSchema,
  },
});

const reviewLayerSchema = Schema.Struct({
  id: idSchema,
  title: Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(REVIEW_TITLE_LENGTH)),
  summary: Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(REVIEW_PROSE_LENGTH)),
  lanes: Schema.Array(
    Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))
      .check(Schema.isMinLength(1))
      .check(Schema.isMaxLength(REVIEW_LANE_NAME_LENGTH)),
  )
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(REVIEW_LANES)),
  steps: Schema.Array(reviewStepSchema)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(REVIEW_STEPS)),
});

const resolvedReviewLayerSchema = Schema.Struct({
  ...reviewLayerSchema.fields,
  ...{
    steps: Schema.Array(resolvedReviewStepSchema)
      .check(Schema.isMinLength(1))
      .check(Schema.isMaxLength(REVIEW_STEPS)),
    fingerprint: fingerprintSchema,
  },
});

const diagramArrowSchema = Schema.Struct({
  from: idSchema,
  to: idSchema,
  label: Schema.optional(
    Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))
      .check(Schema.isMinLength(1))
      .check(Schema.isMaxLength(REVIEW_LABEL_LENGTH)),
  ),
});
const diagramBoxSchema = Schema.Struct({
  id: idSchema,
  label: Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(REVIEW_LABEL_LENGTH)),
  detail: Schema.optional(
    Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))
      .check(Schema.isMinLength(1))
      .check(Schema.isMaxLength(REVIEW_PROSE_LENGTH)),
  ),
  change: Schema.optional(Schema.Literals(['new', 'changed', 'removed'])),
  problem: Schema.optional(
    Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))
      .check(Schema.isMinLength(1))
      .check(Schema.isMaxLength(REVIEW_PROSE_LENGTH)),
  ),
  layerId: Schema.optional(idSchema),
  decision: Schema.optional(Schema.Literal(true)),
});
const diagramSchema = Schema.Struct({
  boxes: Schema.Array(diagramBoxSchema).check(
    Schema.isMaxLength(DIAGRAM_BOXES),
  ),
  arrows: Schema.Array(diagramArrowSchema).check(
    Schema.isMaxLength(DIAGRAM_ARROWS),
  ),
});
const reviewDiagramSchema = Schema.Struct({
  after: diagramSchema,
});

const summaryHtmlSchema = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(REVIEW_SUMMARY_BYTES))
  .check(
    Schema.makeFilter((value: string) => value.isWellFormed(), {
      expected: 'Expected valid Unicode text',
    }),
  )
  .check(
    Schema.makeFilter(
      (value: string) => utf8ByteLength(value) <= REVIEW_SUMMARY_BYTES,
      { expected: `Summary exceeds ${REVIEW_SUMMARY_MEBIBYTES} MiB` },
    ),
  );

const notExplainedSchema = Schema.Struct({
  path: relativePathSchema,
  ranges: Schema.Array(
    Schema.Struct({ startLine: lineSchema, endLine: lineSchema }),
  ),
  deleted: Schema.optional(Schema.Boolean),
  binary: Schema.optional(Schema.Boolean),
});

const reviewIdSchema = Schema.String.check(Schema.isUUID());
const revisionSchema = Schema.Int.check(Schema.isGreaterThan(0));
const proseSchema = Schema.String.check(Schema.isMinLength(1)).check(
  Schema.isMaxLength(REVIEW_PROSE_LENGTH),
);
const httpUrlSchema = Schema.String.check(Schema.isPattern(/^https?:\/\//));
const reviewVerdictSchema = Schema.Struct({
  asked: Schema.Struct({
    text: proseSchema,
    links: Schema.optional(
      Schema.Array(Schema.Struct({ title: proseSchema, url: httpUrlSchema })),
    ),
  }),
  recommendation: Schema.Literals(['merge', 'hold']),
  reasons: Schema.Array(proseSchema)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(5)),
  notProven: Schema.Array(
    Schema.Struct({ what: proseSchema, why: proseSchema }),
  ),
  removed: Schema.Array(
    Schema.Struct({
      behavior: proseSchema,
      why: proseSchema,
      paths: Schema.Array(relativePathSchema).check(Schema.isMinLength(1)),
    }),
  ),
});
const reviewLinksSchema = Schema.Struct({
  web: Schema.String,
  app: Schema.String,
  revision: Schema.Struct({ web: Schema.String, app: Schema.String }),
  decisions: Schema.Array(
    Schema.Struct({
      layerId: idSchema,
      web: Schema.String,
      app: Schema.String,
    }),
  ),
});
const revisionMetadataSchema = Schema.Struct({
  reviewId: reviewIdSchema,
  projectId: Schema.String,
  revision: revisionSchema,
  headOid: Schema.String,
  base: Schema.String,
  baseOid: Schema.String,
  mergeBaseOid: Schema.String,
  publishedAt: isoDateTimeSchema,
  branch: Schema.String,
  worktreePath: Schema.String,
  worktreeName: Schema.String,
});
const publishedReviewSchema = Schema.Struct({
  reviewId: Schema.optional(reviewIdSchema),
  headOid: Schema.optional(Schema.String),
  baseOid: Schema.optional(Schema.String),
  base: Schema.optional(Schema.String),
  mergeBaseOid: Schema.optional(Schema.String),
  verdict: Schema.optional(reviewVerdictSchema),
  links: Schema.optional(reviewLinksSchema),
  environmentId: Schema.String.check(Schema.isUUID()),
  worktreeId: worktreeIdSchema,
  revision: Schema.Number.check(Schema.isInt()).check(Schema.isGreaterThan(0)),
  publishedAt: isoDateTimeSchema,
  active: Schema.Boolean,
  diagnostics: Schema.Literals(['current', 'unavailable']),
  summary: reviewSummaryLinkSchema,
  diagram: Schema.optional(reviewDiagramSchema),
  layers: Schema.Array(resolvedReviewLayerSchema).check(
    Schema.isMaxLength(REVIEW_LAYERS),
  ),
  notExplained: Schema.Array(notExplainedSchema).check(
    Schema.isMaxLength(CHANGED_PATHS),
  ),
  proof: publishedProofSchema,
});

export const publishReviewRequestSchema = Schema.Struct({
  expectedRevision: Schema.Number.check(Schema.isInt())
    .check(Schema.isGreaterThanOrEqualTo(0))
    .check(Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER - 1)),
  summaryHtml: Schema.optional(summaryHtmlSchema),
  verdict: reviewVerdictSchema,
  base: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  pullRequest: Schema.optional(
    Schema.String.check(
      Schema.isPattern(
        /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[1-9][0-9]*\/?$/,
      ),
    ),
  ),
  reviewId: Schema.optional(reviewIdSchema),
  diagram: Schema.optional(reviewDiagramSchema),
  layers: Schema.Array(reviewLayerSchema)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(REVIEW_LAYERS)),
  proof: Schema.optional(proofDraftSchema),
});

export const readPublishedReviewResponseSchema = Schema.Struct({
  review: nullableAsUndefined(publishedReviewSchema),
});
export const publishReviewResponseSchema = Schema.Struct({
  ...readPublishedReviewResponseSchema.fields,
  reviewId: reviewIdSchema,
  revision: revisionSchema,
  headOid: Schema.String,
  baseOid: Schema.String,
  links: reviewLinksSchema,
});
export const projectReviewParamsSchema = Schema.Struct({
  projectId: Schema.String,
});
export const readReviewQuerySchema = Schema.Struct({
  revision: Schema.optional(revisionSchema),
});
export const readReviewDiffsRequestSchema = Schema.Struct({
  paths: readBranchDiffsRequestSchema.fields.paths,
});
export const reviewParamsSchema = Schema.Struct({ reviewId: reviewIdSchema });
export const reviewRevisionParamsSchema = Schema.Struct({
  ...reviewParamsSchema.fields,
  revision: Schema.FiniteFromString.check(Schema.isInt()).check(
    Schema.isGreaterThan(0),
  ),
});
const reviewRecordSchema = Schema.Struct({
  reviewId: reviewIdSchema,
  projectId: Schema.String,
  branch: Schema.String,
  pullRequest: Schema.optional(Schema.String),
  state: Schema.Literals(['open', 'closed']),
  archived: Schema.optional(Schema.Boolean),
  latestRevision: revisionSchema,
  lastSeenRevision: Schema.Int,
});
export const readReviewResponseSchema = Schema.Struct({
  review: nullableAsUndefined(reviewRecordSchema),
  revisions: Schema.Array(revisionMetadataSchema),
  revision: nullableAsUndefined(
    Schema.Struct({
      ...revisionMetadataSchema.fields,
      files: Schema.Array(
        Schema.Struct({
          path: relativePathSchema,
          oldPath: Schema.optional(relativePathSchema),
          newPath: Schema.optional(relativePathSchema),
          oldOid: Schema.optional(Schema.String),
          newOid: Schema.optional(Schema.String),
          oldMode: Schema.String,
          newMode: Schema.String,
          status: Schema.Literals([
            'added',
            'modified',
            'deleted',
            'renamed',
            'type-changed',
          ]),
        }),
      ),
      verdict: reviewVerdictSchema,
      content: publishedReviewSchema,
    }),
  ),
});
export const listProjectReviewsResponseSchema =
  Schema.Array(reviewRecordSchema);
export const setReviewSeenRequestSchema = Schema.Struct({
  revision: revisionSchema,
});
export const setReviewStateRequestSchema = Schema.Struct({
  state: Schema.Literal('closed'),
});
export type ReadReviewResponse = typeof readReviewResponseSchema.Type;

export const deleteReviewResponseSchema = Schema.Struct({
  deleted: Schema.Boolean,
});
export type DeleteReviewResponse = typeof deleteReviewResponseSchema.Type;

export type PublishReviewRequest = typeof publishReviewRequestSchema.Type;
export type ReadPublishedReviewResponse =
  typeof readPublishedReviewResponseSchema.Type;

export const reviewUpdatedResponseSchema = Schema.Struct({
  updated: Schema.Boolean,
});
export const readReviewFileQuerySchema = Schema.Struct({
  path: relativePathSchema,
});
export const readReviewFileResponseSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('text'),
    text: Schema.String,
    blobOid: Schema.String,
  }),
  Schema.Struct({ kind: Schema.Literal('missing') }),
  Schema.Struct({
    kind: Schema.Literals(['too-large', 'unsupported']),
    blobOid: Schema.String,
  }),
]);

const reviewFileMarkSchema = Schema.Struct({
  path: relativePathSchema,
  fingerprint: Schema.String,
  reviewedAt: isoDateTimeSchema,
  stale: Schema.Boolean,
});
const reviewDecisionMarkSchema = Schema.Struct({
  layerId: idSchema,
  fingerprint: fingerprintSchema,
  reviewedAt: isoDateTimeSchema,
});
export const reviewMarksResponseSchema = Schema.Struct({
  files: Schema.Array(reviewFileMarkSchema),
  decisions: Schema.Array(reviewDecisionMarkSchema),
});
export const setReviewMarkRequestSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('file'),
    revision: revisionSchema,
    path: relativePathSchema,
    headBlobOid: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal('decision'),
    revision: revisionSchema,
    layerId: idSchema,
    fingerprint: fingerprintSchema,
  }),
]);
export const removeReviewMarkRequestSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('file'),
    path: relativePathSchema,
    headBlobOid: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal('decision'),
    layerId: idSchema,
    fingerprint: fingerprintSchema,
  }),
]);
export type ReviewMarksResponse = typeof reviewMarksResponseSchema.Type;
export type SetReviewMarkRequest = typeof setReviewMarkRequestSchema.Type;
export type RemoveReviewMarkRequest = typeof removeReviewMarkRequestSchema.Type;

const reviewScopeSchema = Schema.Union([
  Schema.Struct({
    worktreeId: worktreeIdSchema,
    reviewId: Schema.optional(reviewIdSchema),
  }),
  Schema.Struct({
    reviewId: reviewIdSchema,
    worktreeId: Schema.optional(worktreeIdSchema),
  }),
]);
export type ReviewScope = typeof reviewScopeSchema.Type;

export type ReviewParams = typeof reviewParamsSchema.Type;
export type ReviewRevisionParams = typeof reviewRevisionParamsSchema.Type;
export type ProjectReviewParams = typeof projectReviewParamsSchema.Type;
export type ReadReviewQuery = typeof readReviewQuerySchema.Type;
export type ReadReviewDiffsRequest = typeof readReviewDiffsRequestSchema.Type;
export type ReadReviewFileQuery = typeof readReviewFileQuerySchema.Type;
export type SetReviewSeenRequest = typeof setReviewSeenRequestSchema.Type;
export type SetReviewStateRequest = typeof setReviewStateRequestSchema.Type;
