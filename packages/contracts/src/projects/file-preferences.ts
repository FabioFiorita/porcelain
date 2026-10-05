import { Schema } from 'effect';
import { PATH_LENGTH } from '../shared/limits.ts';
import { isRelativePath } from '../shared/relative-path.ts';

const pathSchema = Schema.String.check(
  Schema.makeFilter((path: string) => isRelativePath(path, PATH_LENGTH), {
    expected: 'a normalized relative path',
  }),
);
export const listFilePreferencesResponseSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    preferences: Schema.Array(
      Schema.Struct({
        path: pathSchema,
        pinned: Schema.Boolean,
        hidden: Schema.Boolean,
      }),
    ),
  }),
);
export const setFilePreferenceRequestSchema = Schema.Struct({
  path: pathSchema,
  flag: Schema.Literals(['pinned', 'hidden']),
  value: Schema.Boolean,
});
export const setFilePreferenceResponseSchema =
  listFilePreferencesResponseSchema;
export type ListFilePreferencesResponse =
  typeof listFilePreferencesResponseSchema.Type;
export type SetFilePreferenceRequest =
  typeof setFilePreferenceRequestSchema.Type;
export type SetFilePreferenceResponse =
  typeof setFilePreferenceResponseSchema.Type;
