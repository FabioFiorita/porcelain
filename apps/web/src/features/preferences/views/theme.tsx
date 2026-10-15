import { useHotkey } from '@tanstack/react-hotkeys';
import { type ReactNode } from 'react';
import { useAtomMount } from '@effect/atom-react';
import { cn } from '@/shared/lib/utils';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { nextAppearance } from '@porcelain/client/preferences/rules';
import { usePreferences, themeConnection } from '../store';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { preferences, setPreference, resolvedTheme } = usePreferences();
  useAtomMount(themeConnection);
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
