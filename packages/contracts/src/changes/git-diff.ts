import { Schema } from 'effect';

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
