import { appearanceSchema } from '../rules/preferences.ts';
import { defaultReviewGitSettings } from '../rules/review-git-settings.ts';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as SchemaTransformation from 'effect/SchemaTransformation';
import { COMMIT_MODEL_LENGTH } from '@porcelain/contracts/shared';
import {
  reviewGitSettingsSchema,
  type ReviewGitSettings,
} from '@porcelain/contracts/access';
const fields = Schema.Struct({
  commitModel: Schema.String.check(Schema.isMaxLength(COMMIT_MODEL_LENGTH)),
  appearance: appearanceSchema,
  diffStyle: Schema.Literals(['unified', 'split']),
  lineOverflow: Schema.Literals(['scroll', 'wrap']),
  documentsDefault: Schema.Literals(['rendered', 'source']),
  reviewGitSettingsImportCandidate: reviewGitSettingsSchema,
});
export type Preferences = typeof fields.Type;
export type PreferenceChange = Partial<
  Omit<Preferences, 'reviewGitSettingsImportCandidate'>
>;
export const defaultPreferences: Preferences = {
  commitModel: '',
  appearance: 'system',
  diffStyle: 'unified',
  lineOverflow: 'scroll',
  documentsDefault: 'rendered',
  reviewGitSettingsImportCandidate: defaultReviewGitSettings,
};
function legacyReviewGitSettings(
  saved: Record<string, unknown>,
): ReviewGitSettings {
  const legacy = reviewGitSettingsSchema.fields;
  return {
    pullStrategy: savedField(
      legacy.pullStrategy,
      saved.pullStrategy,
      defaultReviewGitSettings.pullStrategy,
    ),
    collapseSpecs: savedField(
      legacy.collapseSpecs,
      saved.collapseSpecs,
      defaultReviewGitSettings.collapseSpecs,
    ),
    archiveDeleteWorktree: savedField(
      legacy.archiveDeleteWorktree,
      saved.archiveDeleteWorktree,
      defaultReviewGitSettings.archiveDeleteWorktree,
    ),
    archiveDeleteLocalBranch: savedField(
      legacy.archiveDeleteLocalBranch,
      saved.archiveDeleteLocalBranch,
      defaultReviewGitSettings.archiveDeleteLocalBranch,
    ),
    archiveDeleteRemoteBranch: savedField(
      legacy.archiveDeleteRemoteBranch,
      saved.archiveDeleteRemoteBranch,
      defaultReviewGitSettings.archiveDeleteRemoteBranch,
    ),
  };
}
function savedField<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  value: unknown,
  fallback: S['Type'],
): S['Type'] {
  return Option.getOrElse(
    Schema.decodeUnknownOption(schema)(value),
    () => fallback,
  );
}
export const preferencesSchema = Schema.Unknown.pipe(
  Schema.decodeTo(
    fields,
    SchemaTransformation.transform({
      decode: (value) => {
        const saved = Option.getOrElse(
          Schema.decodeUnknownOption(
            Schema.Record(Schema.String, Schema.Unknown),
          )(value),
          (): Record<string, unknown> => ({}),
        );
        return {
          commitModel: savedField(
            fields.fields.commitModel,
            saved.commitModel,
            defaultPreferences.commitModel,
          ),
          appearance: savedField(
            fields.fields.appearance,
            'appearance' in saved ? saved.appearance : saved.theme,
            defaultPreferences.appearance,
          ),
          diffStyle: savedField(
            fields.fields.diffStyle,
            saved.diffStyle,
            defaultPreferences.diffStyle,
          ),
          lineOverflow: savedField(
            fields.fields.lineOverflow,
            'lineOverflow' in saved
              ? saved.lineOverflow
              : typeof saved.wrapLongLines === 'boolean'
                ? saved.wrapLongLines
                  ? 'wrap'
                  : 'scroll'
                : undefined,
            defaultPreferences.lineOverflow,
          ),
          documentsDefault: savedField(
            fields.fields.documentsDefault,
            saved.documentsDefault,
            saved.markdownDefault === 'source' || saved.htmlDefault === 'source'
              ? 'source'
              : defaultPreferences.documentsDefault,
          ),
          reviewGitSettingsImportCandidate: Option.getOrElse(
            Schema.decodeUnknownOption(reviewGitSettingsSchema)(
              saved.reviewGitSettingsImportCandidate,
            ),
            () => legacyReviewGitSettings(saved),
          ),
        };
      },
      encode: (preferences) => preferences,
    }),
  ),
);
export function readPreferences(value: string | null): Preferences {
  return value === null
    ? defaultPreferences
    : Option.getOrElse(
        Schema.decodeUnknownOption(Schema.fromJsonString(preferencesSchema))(
          value,
        ),
        () => defaultPreferences,
      );
}
