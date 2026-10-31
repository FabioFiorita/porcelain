import { Schema } from 'effect';
import { environmentIconSchema } from '@porcelain/access/models';

export const environmentSchema = Schema.Struct({
  name: Schema.String,
  custom: Schema.Boolean,
  icon: Schema.optionalKey(environmentIconSchema),
});

export { environmentIconSchema };
