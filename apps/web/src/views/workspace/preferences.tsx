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

/** Preferences are deliberately device-local until the server exposes a contract. */
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

const appearanceValues = new Set<Preferences['appearance']>([
  'system',
  'light',
  'dark',
]);
const diffStyleValues = new Set<Preferences['diffStyle']>(['unified', 'split']);
const lineOverflowValues = new Set<Preferences['lineOverflow']>([
  'scroll',
  'wrap',
]);
const markdownValues = new Set<Preferences['markdownDefault']>([
  'reader',
  'source',
]);
const htmlValues = new Set<Preferences['htmlDefault']>(['preview', 'source']);

function readPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw == null) return DEFAULT_PREFERENCES;
    const value: unknown = JSON.parse(raw);
    if (value == null || typeof value !== 'object') return DEFAULT_PREFERENCES;
    const stored = value as Record<string, unknown>;
    return {
      pullStrategy: stored.pullStrategy === 'rebase' ? 'rebase' : 'merge',
      commitModel:
        typeof stored.commitModel === 'string' &&
        stored.commitModel.length <= 160
          ? stored.commitModel
          : '',
      appearance: appearanceValues.has(
        stored.appearance as Preferences['appearance'],
      )
        ? (stored.appearance as Preferences['appearance'])
        : DEFAULT_PREFERENCES.appearance,
      diffStyle: diffStyleValues.has(
        stored.diffStyle as Preferences['diffStyle'],
      )
        ? (stored.diffStyle as Preferences['diffStyle'])
        : DEFAULT_PREFERENCES.diffStyle,
      lineOverflow: lineOverflowValues.has(
        stored.lineOverflow as Preferences['lineOverflow'],
      )
        ? (stored.lineOverflow as Preferences['lineOverflow'])
        : DEFAULT_PREFERENCES.lineOverflow,
      markdownDefault: markdownValues.has(
        stored.markdownDefault as Preferences['markdownDefault'],
      )
        ? (stored.markdownDefault as Preferences['markdownDefault'])
        : DEFAULT_PREFERENCES.markdownDefault,
      htmlDefault: htmlValues.has(
        stored.htmlDefault as Preferences['htmlDefault'],
      )
        ? (stored.htmlDefault as Preferences['htmlDefault'])
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

/**
 * The server owns sessions, projects and review data. These display defaults
 * intentionally stay in localStorage and never become network requests.
 */
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
    } catch {
      // Private browsing can deny storage; the current session still works.
    }
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
