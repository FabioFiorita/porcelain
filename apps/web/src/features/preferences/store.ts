import { resolvedTheme } from '@porcelain/client/preferences/rules';
import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { storageRuntime } from '@/shared/adapters/storage';
import {
  preferencesSchema,
  defaultPreferences,
  type Preferences,
} from '@porcelain/client/preferences';

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
