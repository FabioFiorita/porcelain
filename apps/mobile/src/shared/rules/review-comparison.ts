import * as Schema from 'effect/Schema';

export const reviewComparisonSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('worktree') }),
  Schema.Struct({
    kind: Schema.Literal('branch'),
    base: Schema.optional(Schema.String),
  }),
]);

export type ReviewComparison = typeof reviewComparisonSchema.Type;
