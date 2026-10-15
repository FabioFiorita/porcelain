import {
  connectDesktopChrome,
  setDesktopAppearance,
} from '@/shared/adapters/desktop';
import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { storageRuntime } from '@/shared/adapters/storage';
import { resolvedTheme } from '@porcelain/client/preferences/rules';
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

export const themeConnection = Atom.make((get) => {
  get.addFinalizer(connectDesktopChrome());
  const root = document.documentElement;
  const previousDark = root.classList.contains('dark');
  const update = () => {
    const value = get.once(preferences);
    setDesktopAppearance(value.appearance);
    root.classList.toggle(
      'dark',
      resolvedTheme(value.appearance, get.once(systemDark)) === 'dark',
    );
  };
  get.subscribe(preferences, update);
  get.subscribe(systemDark, update);
  update();
  get.addFinalizer(() => {
    root.classList.toggle('dark', previousDark);
  });
});

export { preferences as preferenceValues };
export const resolvedAppearance = Atom.make((get) =>
  resolvedTheme(get(preferences).appearance, get(systemDark)),
);
