import { Schema } from 'effect';

export const readHealthResponseSchema = Schema.Struct({
  status: Schema.Literal('ok'),
  environmentId: Schema.String,
});

export type ReadHealthResponse = typeof readHealthResponseSchema.Type;
