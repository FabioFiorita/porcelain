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
  checksTruncated: Schema.Boolean,
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
const walkthroughCalloutSchema = Schema.Struct({
  kind: Schema.Literal('callout'),
  attention: walkthroughAttentionSchema,
  comparison: Schema.optional(
    Schema.Struct({
      columns: Schema.Array(Schema.String),
      rows: Schema.Array(Schema.Array(Schema.String)),
      implemented: Schema.optional(Schema.String),
    }),
  ),
});

const diagramLinesSchema = Schema.Struct({
  side: Schema.Literals(['new', 'old']),
  start: Schema.Int,
  end: Schema.Int,
});
const diagramNodeSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  kind: Schema.optional(
    Schema.Literals([
      'file',
      'function',
      'type',
      'component',
      'route',
      'table',
      'test',
      'external',
    ]),
  ),
  note: Schema.optional(Schema.String),
  mark: Schema.optional(
    Schema.Literals(['added', 'changed', 'removed', 'unchanged']),
  ),
  anchor: Schema.optional(
    Schema.Struct({
      path: Schema.String,
      lines: Schema.optional(diagramLinesSchema),
    }),
  ),
});
const diagramEdgeSchema = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  label: Schema.optional(Schema.String),
  mark: Schema.optional(Schema.Literals(['added', 'removed'])),
});
const diagramSchema = Schema.Struct({
  kind: Schema.Literal('diagram'),
  title: Schema.optional(Schema.String),
  layout: Schema.Literals(['flow', 'layers', 'sequence']),
  nodes: Schema.Array(diagramNodeSchema),
  edges: Schema.Array(diagramEdgeSchema),
});

export const walkthroughBlockRequestSchema = Schema.Union([
  diffExcerptSchema,
  imagesSchema,
  filesSchema,
  checksRequestSchema,
  walkthroughCalloutSchema,
  diagramSchema,
]);

export const walkthroughBlockSchema = Schema.Union([
  Schema.Struct({
    ...diffExcerptSchema.fields,
    headOid: Schema.String,
    contentTreeOid: Schema.String,
  }),
  imagesSchema,
  filesSchema,
  Schema.Struct({
    ...checksRequestSchema.fields,
    ...walkthroughChecksSchema.fields,
  }),
  walkthroughCalloutSchema,
  diagramSchema,
]);
export type WalkthroughBlock = typeof walkthroughBlockSchema.Type;
export type WalkthroughBlockRequest = typeof walkthroughBlockRequestSchema.Type;
export type WalkthroughChecks = typeof walkthroughChecksSchema.Type;
