import { appearanceSchema } from './rules/preferences.ts';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as SchemaTransformation from 'effect/SchemaTransformation';
import { COMMIT_MODEL_LENGTH } from '@porcelain/contracts/shared';
const fields = Schema.Struct({
  commitModel: Schema.String.check(Schema.isMaxLength(COMMIT_MODEL_LENGTH)),
  pullStrategy: Schema.Literals(['merge', 'rebase']),
  appearance: appearanceSchema,
  diffStyle: Schema.Literals(['unified', 'split']),
  lineOverflow: Schema.Literals(['scroll', 'wrap']),
  markdownDefault: Schema.Literals(['reader', 'source']),
  htmlDefault: Schema.Literals(['preview', 'source']),
  collapseSpecs: Schema.Boolean,
});
export type Preferences = typeof fields.Type;
export const defaultPreferences: Preferences = {
  commitModel: '',
  pullStrategy: 'merge',
  appearance: 'system',
  diffStyle: 'unified',
  lineOverflow: 'scroll',
  markdownDefault: 'reader',
  htmlDefault: 'preview',
  collapseSpecs: false,
};
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
          pullStrategy: savedField(
            fields.fields.pullStrategy,
            saved.pullStrategy,
            defaultPreferences.pullStrategy,
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
          markdownDefault: savedField(
            fields.fields.markdownDefault,
            saved.markdownDefault,
            defaultPreferences.markdownDefault,
          ),
          htmlDefault: savedField(
            fields.fields.htmlDefault,
            saved.htmlDefault,
            defaultPreferences.htmlDefault,
          ),
          collapseSpecs: savedField(
            fields.fields.collapseSpecs,
            saved.collapseSpecs,
            defaultPreferences.collapseSpecs,
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
