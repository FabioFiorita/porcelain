import { Schema } from 'effect';
import { expectedFileSchema } from '@porcelain/kernel/models';
export const fingerprintedFileSchema = Schema.Struct({
  ...expectedFileSchema.fields,
  fingerprint: Schema.mutableKey(Schema.String),
});

export type FingerprintedFile = typeof fingerprintedFileSchema.Type;
