import { Schema } from 'effect';

export const environmentSchema = Schema.Struct({
  name: Schema.String,
  custom: Schema.Boolean,
});
