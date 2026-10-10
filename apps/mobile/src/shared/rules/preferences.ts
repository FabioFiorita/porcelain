import * as Schema from 'effect/Schema';

export const preferencesSchema = Schema.Struct({
  theme: Schema.Literals(['system', 'light', 'dark']),
  wrapLongLines: Schema.Boolean,
  markdownDefault: Schema.Literals(['reader', 'source']),
  htmlDefault: Schema.Literals(['preview', 'source']),
});

export type Preferences = typeof preferencesSchema.Type;

export const defaultPreferences: Preferences = {
  theme: 'system',
  wrapLongLines: true,
  markdownDefault: 'reader',
  htmlDefault: 'preview',
};

export function readPreferences(value: string | null): Preferences {
  return value === null
    ? defaultPreferences
    : Schema.decodeUnknownSync(Schema.fromJsonString(preferencesSchema))(value);
}
