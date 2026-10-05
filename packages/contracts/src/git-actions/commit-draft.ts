import { Schema } from 'effect';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import {
  CHANGED_PATHS,
  COMMIT_GROUPS,
  COMMIT_MESSAGE_BYTES,
  COMMIT_MODEL_LENGTH,
} from '../shared/limits.ts';

export const listCommitModelsResponseSchema = Schema.Array(
  Schema.Struct({ id: Schema.String, label: Schema.String }),
);

export const generateCommitDraftRequestSchema = Schema.Struct({
  mode: Schema.Literals(['message', 'groups']),
  model: Schema.String.check(Schema.isMinLength(1)).check(
    Schema.isMaxLength(COMMIT_MODEL_LENGTH),
  ),
  expectedStatusToken: fingerprintSchema,
  paths: Schema.Array(relativePathSchema)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(CHANGED_PATHS)),
});
export const generateCommitDraftResponseSchema = Schema.Struct({
  groups: Schema.Array(
    Schema.Struct({
      message: Schema.String.check(Schema.isMinLength(1)).check(
        Schema.isMaxLength(COMMIT_MESSAGE_BYTES),
      ),
      paths: Schema.Array(relativePathSchema)
        .check(Schema.isMinLength(1))
        .check(Schema.isMaxLength(CHANGED_PATHS)),
    }),
  )
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(COMMIT_GROUPS)),
  expectedFiles: Schema.Array(
    Schema.Struct({ path: relativePathSchema, fingerprint: fingerprintSchema }),
  ).check(Schema.isMaxLength(CHANGED_PATHS)),
});

export type ListCommitModelsResponse =
  typeof listCommitModelsResponseSchema.Type;
export type GenerateCommitDraftRequest =
  typeof generateCommitDraftRequestSchema.Type;
export type GenerateCommitDraftResponse =
  typeof generateCommitDraftResponseSchema.Type;
