import { environmentSchema } from '../shared/environment.ts';
import { Schema, SchemaTransformation } from 'effect';
import {
  nullableAsUndefined,
  projectIdSchema,
  worktreeIdSchema,
} from '../shared/schema.ts';
import { requestParseOptions } from '../shared/http-api.ts';
import { PATH_LENGTH, PROJECT_NAME_LENGTH } from '../shared/limits.ts';

const absolutePathSchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(PATH_LENGTH),
  Schema.makeFilter(
    (path: string) => path.startsWith('/') && !path.includes('\0'),
    { expected: 'an absolute path without NUL' },
  ),
);
const worktreeSchema = Schema.Struct({
  id: worktreeIdSchema,
  path: Schema.String,
  main: Schema.Boolean,
  branch: nullableAsUndefined(Schema.String),
  available: Schema.Boolean,
  status: nullableAsUndefined(
    Schema.Literals(['pending', 'reviewed', 'replied']),
  ),
});
const projectSchema = Schema.Struct({
  id: projectIdSchema,
  name: Schema.String,
  available: Schema.Boolean,
  worktrees: Schema.Array(worktreeSchema),
});

export const renameProjectParamsSchema = Schema.Struct({
  projectId: projectIdSchema,
});
export const removeProjectParamsSchema = renameProjectParamsSchema;
export const listFilePreferencesParamsSchema = renameProjectParamsSchema;
export const setFilePreferenceParamsSchema = renameProjectParamsSchema;

export const readInventoryResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    environmentId: projectIdSchema,
    environment: environmentSchema,
    projects: Schema.Array(projectSchema),
  }),
);
export const registerProjectRequestSchema = Schema.Struct({
  path: absolutePathSchema,
});
export const registerProjectResponseSchema =
  Schema.toStandardSchemaV1(projectSchema);
export const removeProjectResponseSchema = Schema.Struct({
  deleted: Schema.Boolean,
});
export const browseProjectFoldersQuerySchema = Schema.Struct({
  path: Schema.optionalKey(absolutePathSchema),
});
export const browseProjectFoldersResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    path: Schema.String,
    parent: nullableAsUndefined(Schema.String),
    directories: Schema.Array(
      Schema.Struct({ name: Schema.String, path: Schema.String }),
    ),
    repository: Schema.Boolean,
    truncated: Schema.Boolean,
  }),
);
const projectName = Schema.String.pipe(
  Schema.decodeTo(
    Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(PROJECT_NAME_LENGTH),
      Schema.makeFilter((value: string) => !/[\p{Cc}\p{Cf}]/u.test(value), {
        expected: 'a name without control characters',
      }),
    ),
    SchemaTransformation.transform({
      decode: (value: string) => value.trim(),
      encode: (value: string) => value,
    }),
  ),
);
export const renameProjectRequestSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ name: projectName }),
  { parseOptions: requestParseOptions },
);
export const renameProjectResponseSchema = Schema.Struct({
  id: projectIdSchema,
  name: Schema.String,
});

export type RenameProjectParams = typeof renameProjectParamsSchema.Type;
export type RemoveProjectParams = typeof removeProjectParamsSchema.Type;
export type ListFilePreferencesParams =
  typeof listFilePreferencesParamsSchema.Type;
export type SetFilePreferenceParams = typeof setFilePreferenceParamsSchema.Type;
export type ReadInventoryResponse = typeof readInventoryResponseSchema.Type;
export type RegisterProjectRequest = typeof registerProjectRequestSchema.Type;
export type RegisterProjectResponse = typeof registerProjectResponseSchema.Type;
export type RemoveProjectResponse = typeof removeProjectResponseSchema.Type;
export type BrowseProjectFoldersQuery =
  typeof browseProjectFoldersQuerySchema.Type;
export type BrowseProjectFoldersResponse =
  typeof browseProjectFoldersResponseSchema.Type;
export type RenameProjectRequest = typeof renameProjectRequestSchema.Type;
export type RenameProjectResponse = typeof renameProjectResponseSchema.Type;
