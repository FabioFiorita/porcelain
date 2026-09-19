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
import type { Preferences } from '../../contracts/preferences';
import { DEFAULT_COMMIT_MODEL } from '../../domain/models';

const STORAGE_KEY = 'porcelain.prototype.preferences';

const DEFAULT_PREFERENCES: Preferences = {
  appearance: 'system',
  diffStyle: 'unified',
  lineOverflow: 'scroll',
  markdownDefault: 'reader',
  htmlDefault: 'preview',
  // As Git does: a pull never creates a merge commit unless you ask for one.
  pullStrategy: 'ff-only',
  commitModel: DEFAULT_COMMIT_MODEL,
};

function read(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw == null
      ? DEFAULT_PREFERENCES
      : { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
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

function useSystemDark(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = matchMedia('(prefers-color-scheme: dark)');
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => matchMedia('(prefers-color-scheme: dark)').matches,
  );
}

/**
 * PROPOSED: preferences have no contract, so they stay on this device. The
 * theme class lives on <html> because shadcn's dark variant reads it there.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(read);
  const systemDark = useSystemDark();

  const setPreference = useCallback<PreferencesContext['setPreference']>(
    (key, value) => {
      setPreferences((current) => {
        const next = { ...current, [key]: value };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

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
