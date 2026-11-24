import { Schema } from 'effect';
import { DIFFS_PER_REQUEST, PATHS_PER_CHANGE } from '../shared/limits.ts';

export const gitDiffContentSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('text'), patch: Schema.String }),
  Schema.Struct({ kind: Schema.Literal('binary') }),
  Schema.Struct({
    kind: Schema.Literal('metadata-only'),
    patch: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal('omitted'),
    reason: Schema.Literals([
      'size-limit',
      'unsupported-encoding',
      'unsupported-submodule',
    ]),
  }),
]);

export const comparisonPathsSchema = Schema.Array(
  Schema.Array(Schema.String)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(PATHS_PER_CHANGE)),
)
  .check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(DIFFS_PER_REQUEST));
export const comparisonPatchesSchema = Schema.Array(
  Schema.Struct({
    paths: Schema.Array(Schema.String),
    content: gitDiffContentSchema,
  }),
);
