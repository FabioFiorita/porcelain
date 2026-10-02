import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSyncExternalStore } from 'react';
import { savedJson } from '@/shared/lib/saved-json';
import {
  defaultPreferences,
  readPreferences,
  resolvedTheme,
  type Preferences,
} from './rules/preferences';

type PreferencesState = {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => void;
};

const usePreferencesStore = create<PreferencesState>()(
  persist<PreferencesState, [], [], Preferences>(
    (set) => ({
      preferences: defaultPreferences,
      setPreference: (key, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        })),
    }),
    {
      name: 'porcelain.prototype.preferences',
      storage: savedJson(() => localStorage, readPreferences),
      partialize: ({ preferences }) => preferences,
      merge: (saved, current) => ({
        ...current,
        preferences: readPreferences(saved),
      }),
    },
  ),
);

const darkScheme = '(prefers-color-scheme: dark)';

function subscribeToSystemTheme(onChange: () => void) {
  const query = window.matchMedia(darkScheme);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function systemIsDark() {
  return window.matchMedia(darkScheme).matches;
}

export function usePreferences() {
  const preferences = usePreferencesStore((state) => state.preferences);
  const setPreference = usePreferencesStore((state) => state.setPreference);
  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    systemIsDark,
    () => false,
  );
  return {
    preferences,
    setPreference,
    resolvedTheme: resolvedTheme(preferences.appearance, systemDark),
  };
}

export function useTheme() {
  const { resolvedTheme: theme } = usePreferences();
  return { dark: theme === 'dark' };
}
