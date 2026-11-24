import { Schema } from 'effect';

const diffExcerptSchema = Schema.Struct({
  kind: Schema.Literal('diff_excerpt'),
  path: Schema.String,
  side: Schema.Literals(['new', 'old']),
  start: Schema.Int,
  end: Schema.Int,
  caption: Schema.String,
});
const imageSchema = Schema.Struct({
  assetId: Schema.String,
  shows: Schema.String,
});
const imagesSchema = Schema.Struct({
  kind: Schema.Literal('before_after'),
  before: imageSchema,
  after: imageSchema,
});
const filesSchema = Schema.Struct({
  kind: Schema.Literal('files'),
  files: Schema.Array(
    Schema.Struct({ path: Schema.String, note: Schema.String }),
  ),
});
const checksRequestSchema = Schema.Struct({
  kind: Schema.Literal('checks'),
  headOid: Schema.String,
});
const walkthroughChecksSchema = Schema.Struct({
  state: Schema.String,
  results: Schema.Array(
    Schema.Struct({ name: Schema.String, status: Schema.String }),
  ),
});
const walkthroughAttentionSchema = Schema.Struct({
  kind: Schema.Literals([
    'tradeoff',
    'contract',
    'product',
    'risk',
    'accessibility',
  ]),
  note: Schema.String,
  question: Schema.String,
});
const calloutSchema = Schema.Struct({
  kind: Schema.Literal('callout'),
  attention: walkthroughAttentionSchema,
  comparison: Schema.optional(
    Schema.Struct({
      columns: Schema.Array(Schema.String),
      rows: Schema.Array(Schema.Array(Schema.String)),
    }),
  ),
});

export const walkthroughBlockRequestSchema = Schema.Union([
  diffExcerptSchema,
  imagesSchema,
  filesSchema,
  checksRequestSchema,
  calloutSchema,
]);

export const walkthroughBlockSchema = Schema.Union([
  Schema.Struct({ ...diffExcerptSchema.fields, headOid: Schema.String }),
  imagesSchema,
  filesSchema,
  Schema.Struct({
    ...checksRequestSchema.fields,
    ...walkthroughChecksSchema.fields,
  }),
  calloutSchema,
]);
export type WalkthroughBlock = typeof walkthroughBlockSchema.Type;
export type WalkthroughBlockRequest = typeof walkthroughBlockRequestSchema.Type;
export type WalkthroughChecks = typeof walkthroughChecksSchema.Type;
