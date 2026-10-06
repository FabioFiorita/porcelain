import { Schema } from 'effect';

export const ownerStatusSchema = Schema.Struct({
  address: Schema.String,
  dataDirectory: Schema.String,
  pid: Schema.Int,
});

export type OwnerStatus = typeof ownerStatusSchema.Type;
