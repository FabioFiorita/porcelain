import { useHotkey } from '@tanstack/react-hotkeys';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import {
  PreferencesProvider,
  usePreferences,
} from '@/shared/workspace/preferences';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <ThemeSurface>{children}</ThemeSurface>
    </PreferencesProvider>
  );
}

function ThemeSurface({ children }: { children: ReactNode }) {
  const { preferences, resolvedTheme, setPreference } = usePreferences();
  useHotkey(
    SHORTCUTS.cycleAppearance,
    () => {
      const order = ['system', 'light', 'dark'] as const;
      const index = order.indexOf(preferences.appearance);
      setPreference(
        'appearance',
        order[(index + 1) % order.length] ?? 'system',
      );
    },
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

export function useTheme() {
  const { resolvedTheme } = usePreferences();
  return { dark: resolvedTheme === 'dark' };
}
