import { Schema, SchemaTransformation } from 'effect';
import { nullableAsUndefined } from '../shared/schema.ts';
import { environmentSchema } from '../shared/environment.ts';
import { ENVIRONMENT_NAME_LENGTH } from '../shared/limits.ts';

export const readEnvironmentResponseSchema = Schema.Struct({
  environmentId: Schema.String,
  name: Schema.String,
  version: nullableAsUndefined(Schema.String),
  protocol: Schema.Number.check(Schema.isInt()).check(Schema.isGreaterThan(0)),
});

export const renameEnvironmentRequestSchema = Schema.Struct({
  name: Schema.NullOr(
    Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))
      .check(Schema.isMinLength(1))
      .check(Schema.isMaxLength(ENVIRONMENT_NAME_LENGTH))
      .check(Schema.makeFilter((name: string) => !/\p{Cc}/u.test(name))),
  ),
});

export const renameEnvironmentResponseSchema = environmentSchema;

export type ReadEnvironmentResponse = typeof readEnvironmentResponseSchema.Type;
export type RenameEnvironmentRequest =
  typeof renameEnvironmentRequestSchema.Type;
export type RenameEnvironmentResponse =
  typeof renameEnvironmentResponseSchema.Type;
