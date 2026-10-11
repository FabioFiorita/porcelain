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

const publishedReviewSchema = Schema.Struct({
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
  summaryHtml: summaryHtmlSchema,
  diagram: Schema.optional(reviewDiagramSchema),
  layers: Schema.Array(reviewLayerSchema)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(REVIEW_LAYERS)),
  proof: Schema.optional(proofDraftSchema),
});

export const readPublishedReviewResponseSchema = Schema.Struct({
  review: nullableAsUndefined(publishedReviewSchema),
});
export const publishReviewResponseSchema = readPublishedReviewResponseSchema;

export type PublishReviewRequest = typeof publishReviewRequestSchema.Type;
export type ReadPublishedReviewResponse =
  typeof readPublishedReviewResponseSchema.Type;
