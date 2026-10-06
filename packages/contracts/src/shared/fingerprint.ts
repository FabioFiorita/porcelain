import { Schema } from 'effect';

export const fingerprintSchema = Schema.String.check(
  Schema.isPattern(/^[a-f0-9]{64}$/),
);
