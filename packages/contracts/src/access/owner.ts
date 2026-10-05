import { Schema } from 'effect';

export const readOwnerStatusResponseSchema = Schema.Struct({
  address: Schema.String,
  dataDirectory: Schema.String,
  pid: Schema.Number.check(Schema.isInt()).check(Schema.isGreaterThan(0)),
});

export type ReadOwnerStatusResponse = typeof readOwnerStatusResponseSchema.Type;
