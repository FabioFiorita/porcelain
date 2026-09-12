import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { MoonIcon, SunIcon } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const THEME_SHORTCUT = 'Alt+Shift+D';
const Context = createContext<{ dark: boolean; toggle: () => void } | null>(
  null,
);

// The theme owns its own DOM surface so the control can be rendered wherever the
// layout needs it instead of being threaded through the workspace as an element.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  // Kept stable only because the context value must not be a fresh object each
  // render; the provider has no other state, so this saves no renders by itself.
  const theme = useMemo(
    () => ({ dark, toggle: () => setDark((current) => !current) }),
    [dark],
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);
  useHotkey(THEME_SHORTCUT, theme.toggle, { ignoreInputs: true });
  return (
    <Context value={theme}>
      <div
        className={cn(
          'min-h-svh bg-background text-foreground',
          dark && 'dark',
        )}
      >
        {children}
      </div>
    </Context>
  );
}

function useTheme() {
  const context = useContext(Context);
  if (!context) throw new Error('ThemeProvider is required');
  return context;
}

export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <Button
      aria-keyshortcuts={THEME_SHORTCUT}
      title={`Toggle theme (${formatForDisplay(THEME_SHORTCUT)})`}
      variant="ghost"
      size="icon-sm"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggle}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
