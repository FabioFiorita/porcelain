import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { MoonIcon, SunIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PreferencesProvider, usePreferences } from './preferences';
import { SHORTCUTS } from './shortcuts';

/** Keep the old provider name for callers while preferences remain device-local. */
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

/** Compatibility adapter for review surfaces that only need the resolved mode. */
export function useTheme() {
  const { preferences, resolvedTheme, setPreference } = usePreferences();
  return {
    dark: resolvedTheme === 'dark',
    toggle: () =>
      setPreference('appearance', resolvedTheme === 'dark' ? 'light' : 'dark'),
    appearance: preferences.appearance,
  };
}

export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <Button
      aria-keyshortcuts={SHORTCUTS.cycleAppearance}
      title={`Toggle theme (${formatForDisplay(SHORTCUTS.cycleAppearance)})`}
      variant="ghost"
      size="icon-sm"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggle}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
