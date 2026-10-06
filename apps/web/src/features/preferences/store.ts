import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { Effect, Option, Schema } from 'effect';
import { COMMIT_MODEL_LENGTH } from '@porcelain/contracts/shared';
import { storageRuntime } from '@/shared/adapters/storage';
import {
  defaultPreferences,
  resolvedTheme,
  type Preferences,
} from './rules/preferences';

function savedField<S extends Schema.ConstraintCodec<unknown, unknown>>(
  schema: S,
  fallback: S['Type'],
) {
  const repaired = Schema.catchDecoding<S>(() =>
    Effect.succeed(Option.some(fallback)),
  )(schema);
  return Schema.withDecodingDefaultTypeKey<typeof repaired>(
    Effect.succeed(fallback),
  )(repaired);
}
const preferencesSchema = Schema.Struct({
  commitModel: savedField(
    Schema.String.check(Schema.isMaxLength(COMMIT_MODEL_LENGTH)),
    '',
  ),
  pullStrategy: savedField(Schema.Literals(['merge', 'rebase']), 'merge'),
  appearance: savedField(
    Schema.Literals(['system', 'light', 'dark']),
    'system',
  ),
  diffStyle: savedField(Schema.Literals(['unified', 'split']), 'unified'),
  lineOverflow: savedField(Schema.Literals(['scroll', 'wrap']), 'scroll'),
  markdownDefault: savedField(Schema.Literals(['reader', 'source']), 'reader'),
  htmlDefault: savedField(Schema.Literals(['preview', 'source']), 'preview'),
  collapseSpecs: savedField(Schema.Boolean, false),
}).pipe(
  Schema.catchDecoding(() => Effect.succeed(Option.some(defaultPreferences))),
) satisfies Schema.ConstraintCodec<Preferences, unknown, never, never>;

const preferences = Atom.kvs({
  runtime: storageRuntime,
  key: 'porcelain.prototype.preferences',
  schema: preferencesSchema,
  defaultValue: () => defaultPreferences,
});
const systemDark = Atom.make((get) => {
  if (typeof window === 'undefined') return false;
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const changed = () => get.setSelf(query.matches);
  query.addEventListener('change', changed);
  get.addFinalizer(() => query.removeEventListener('change', changed));
  return query.matches;
});
export function usePreferences() {
  const value = useAtomValue(preferences);
  const set = useAtomSet(preferences);
  const dark = useAtomValue(systemDark);
  return {
    preferences: value,
    setPreference: <K extends keyof Preferences>(
      key: K,
      value: Preferences[K],
    ) => set((current) => ({ ...current, [key]: value })),
    resolvedTheme: resolvedTheme(value.appearance, dark),
  };
}
export function useTheme() {
  const { resolvedTheme: theme } = usePreferences();
  return { dark: theme === 'dark' };
}
