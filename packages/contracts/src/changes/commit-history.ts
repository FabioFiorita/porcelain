import { Schema, SchemaTransformation } from 'effect';
import { COMMITS_PER_PAGE, HISTORY_FRONTIER } from '../shared/limits.ts';
import { nullableAsUndefined } from '../shared/schema.ts';
import { oidListSchema, oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';

const oidCursorWireSchema = oidListSchema;
const oidCursorValueSchema = Schema.Array(oidSchema);
const oidCursorSchema = oidCursorWireSchema.pipe(
  Schema.decodeTo(
    oidCursorValueSchema,
    SchemaTransformation.transform<
      typeof oidCursorValueSchema.Type,
      typeof oidCursorWireSchema.Type
    >({
      decode: (list) => list.split(','),
      encode: (oids) => oids.join(','),
    }),
  ),
);

export const listCommitsQuerySchema = Schema.Struct({
  limit: Schema.optional(
    Schema.NumberFromString.check(Schema.isInt())
      .check(Schema.isGreaterThanOrEqualTo(1))
      .check(Schema.isLessThanOrEqualTo(COMMITS_PER_PAGE)),
  ),
  after: Schema.optional(oidCursorSchema),
  tip: Schema.optional(oidSchema),
});

const commitHeadSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('attached'), ref: Schema.String }),
  Schema.Struct({ kind: Schema.Literal('detached') }),
  Schema.Struct({ kind: Schema.Literal('unborn'), ref: Schema.String }),
]);

export const commitSummarySchema = Schema.Struct({
  oid: oidSchema,
  parentOids: Schema.Array(oidSchema),
  author: Schema.Struct({ name: Schema.String, timestamp: Schema.String }),
  subject: Schema.String,
  subjectTruncated: Schema.Boolean,
  body: nullableAsUndefined(Schema.String),
  bodyTruncated: Schema.Boolean,
  refs: Schema.Array(Schema.String),
});

export const listCommitsResponseSchema = Schema.Struct({
  snapshot: nullableAsUndefined(
    Schema.Struct({
      tipOid: nullableAsUndefined(oidSchema),
      head: commitHeadSchema,
    }),
  ),
  commits: Schema.Array(commitSummarySchema).check(
    Schema.isMaxLength(COMMITS_PER_PAGE),
  ),
  nextAfter: nullableAsUndefined(
    Schema.Array(oidSchema).check(Schema.isMaxLength(HISTORY_FRONTIER)),
  ),
  tip: nullableAsUndefined(oidSchema),
  boundary: nullableAsUndefined(Schema.Literals(['shallow', 'wide'])),
  restarted: Schema.Boolean,
});

export const listFileCommitsQuerySchema = Schema.Struct({
  path: relativePathSchema,
  limit: Schema.optional(
    Schema.NumberFromString.check(Schema.isInt())
      .check(Schema.isGreaterThanOrEqualTo(1))
      .check(Schema.isLessThanOrEqualTo(COMMITS_PER_PAGE)),
  ),
});

export const listFileCommitsResponseSchema = Schema.Struct({
  commits: Schema.Array(
    Schema.Struct({
      commit: commitSummarySchema,
      path: Schema.String,
      previousPath: nullableAsUndefined(Schema.String),
      status: Schema.Literals([
        'added',
        'modified',
        'deleted',
        'renamed',
        'type-changed',
      ]),
    }),
  ).check(Schema.isMaxLength(COMMITS_PER_PAGE)),
  more: Schema.Boolean,
});

export type ListCommitsQuery = typeof listCommitsQuerySchema.Type;
export type ListCommitsResponse = typeof listCommitsResponseSchema.Type;
export type ListFileCommitsQuery = typeof listFileCommitsQuerySchema.Type;
export type ListFileCommitsResponse = typeof listFileCommitsResponseSchema.Type;
