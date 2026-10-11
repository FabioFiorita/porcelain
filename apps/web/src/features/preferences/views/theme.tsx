import { useHotkey } from '@tanstack/react-hotkeys';
import { type ReactNode, useEffect } from 'react';
import {
  connectDesktopChrome,
  setDesktopAppearance,
} from '@/shared/adapters/desktop';
import { cn } from '@/shared/lib/utils';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { nextAppearance } from '@porcelain/client/preferences/rules';
import { usePreferences } from '../store';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { preferences, setPreference, resolvedTheme } = usePreferences();
  useEffect(connectDesktopChrome, []);
  useEffect(
    () => setDesktopAppearance(preferences.appearance),
    [preferences.appearance],
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);
  useHotkey(
    SHORTCUTS.cycleAppearance,
    () => setPreference('appearance', nextAppearance(preferences.appearance)),
    { ignoreInputs: true },
  );
  return (
    <div
      className={cn(
        'min-h-svh bg-background text-foreground',
        resolvedTheme === 'dark' && 'dark',
      )}
    >
      {children}
    </div>
  );
}
