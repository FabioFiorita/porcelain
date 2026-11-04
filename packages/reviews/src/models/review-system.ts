import { Schema } from 'effect';
import { diagramBoxSchema } from './review-diagram.ts';

export const reviewSystemSchema = Schema.Struct({
  kind: Schema.Literal('imports'),
  owners: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      change: Schema.optional(Schema.Literals(['new', 'changed', 'removed'])),
      files: Schema.Array(
        Schema.Struct({
          path: Schema.String,
          importers: Schema.Int,
          change: Schema.optional(
            Schema.Literals(['new', 'changed', 'removed']),
          ),
        }),
      ),
      layerIds: Schema.Array(Schema.String),
      annotations: Schema.Array(diagramBoxSchema),
    }),
  ),
  edges: Schema.Array(
    Schema.Struct({
      from: Schema.String,
      to: Schema.String,
      change: Schema.optional(Schema.Literals(['new', 'removed'])),
    }),
  ),
  guards: Schema.Array(Schema.String),
  unresolved: Schema.Int,
});
export type ReviewSystem = typeof reviewSystemSchema.Type;
export type ModuleGraph = readonly {
  path: string;
  imports: readonly string[];
  owner?: string;
  unresolved: number;
}[];
export const reviewSamplesSchema = Schema.Array(
  Schema.Struct({
    layerId: Schema.String,
    stepId: Schema.String,
    sampled: Schema.Boolean,
  }),
);
export type ReviewSamples = typeof reviewSamplesSchema.Type;
