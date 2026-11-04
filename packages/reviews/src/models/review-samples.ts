import { Schema } from 'effect';
export const reviewSamplesSchema = Schema.Array(
  Schema.Struct({
    layerId: Schema.String,
    stepId: Schema.String,
    sampled: Schema.Boolean,
  }),
);
export type ReviewSamples = typeof reviewSamplesSchema.Type;
