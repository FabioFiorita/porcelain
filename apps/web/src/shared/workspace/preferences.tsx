import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

export type Preferences = {
  commitModel: string;
  pullStrategy: 'merge' | 'rebase';
  appearance: 'system' | 'light' | 'dark';
  diffStyle: 'unified' | 'split';
  lineOverflow: 'scroll' | 'wrap';
  markdownDefault: 'reader' | 'source';
  htmlDefault: 'preview' | 'source';
};

const PREFERENCES_STORAGE_KEY = 'porcelain.prototype.preferences';

const DEFAULT_PREFERENCES: Preferences = {
  commitModel: '',
  pullStrategy: 'merge',
  appearance: 'system',
  diffStyle: 'unified',
  lineOverflow: 'scroll',
  markdownDefault: 'reader',
  htmlDefault: 'preview',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw == null) return DEFAULT_PREFERENCES;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return DEFAULT_PREFERENCES;
    const stored = value;
    return {
      pullStrategy: stored.pullStrategy === 'rebase' ? 'rebase' : 'merge',
      commitModel:
        typeof stored.commitModel === 'string' &&
        stored.commitModel.length <= 160
          ? stored.commitModel
          : '',
      appearance:
        stored.appearance === 'system' ||
        stored.appearance === 'light' ||
        stored.appearance === 'dark'
          ? stored.appearance
          : DEFAULT_PREFERENCES.appearance,
      diffStyle:
        stored.diffStyle === 'unified' || stored.diffStyle === 'split'
          ? stored.diffStyle
          : DEFAULT_PREFERENCES.diffStyle,
      lineOverflow:
        stored.lineOverflow === 'scroll' || stored.lineOverflow === 'wrap'
          ? stored.lineOverflow
          : DEFAULT_PREFERENCES.lineOverflow,
      markdownDefault:
        stored.markdownDefault === 'reader' ||
        stored.markdownDefault === 'source'
          ? stored.markdownDefault
          : DEFAULT_PREFERENCES.markdownDefault,
      htmlDefault:
        stored.htmlDefault === 'preview' || stored.htmlDefault === 'source'
          ? stored.htmlDefault
          : DEFAULT_PREFERENCES.htmlDefault,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function subscribeToSystemTheme(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return () => undefined;
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function systemIsDark() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

type PreferencesContext = {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => void;
  resolvedTheme: 'light' | 'dark';
};

const Context = createContext<PreferencesContext | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    systemIsDark,
    () => false,
  );

  const setPreference = useCallback<PreferencesContext['setPreference']>(
    (key, value) => {
      setPreferences((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );
    } catch {}
  }, [preferences]);

  const resolvedTheme =
    preferences.appearance === 'system'
      ? systemDark
        ? 'dark'
        : 'light'
      : preferences.appearance;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const value = useMemo(
    () => ({ preferences, setPreference, resolvedTheme }),
    [preferences, setPreference, resolvedTheme],
  );
  return <Context value={value}>{children}</Context>;
}

export function usePreferences(): PreferencesContext {
  const context = useContext(Context);
  if (context == null) throw new Error('PreferencesProvider is required');
  return context;
}
