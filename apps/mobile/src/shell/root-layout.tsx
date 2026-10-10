import '../app.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Uniwind, useCSSVariable, useUniwind } from 'uniwind';
import { ShellStartup } from './shell-startup';
import { RegistryProvider } from '@effect/atom-react';
import { usePreferences } from '../features/preferences';
import { useEffect } from 'react';

function themeColor(
  value: string | number | undefined,
  fallback: ColorValue,
): ColorValue {
  return typeof value === 'string' ? value : fallback;
}

export function RootLayout() {
  return (
    <RegistryProvider>
      <ThemedShell />
    </RegistryProvider>
  );
}

function ThemedShell() {
  const { preferences, read } = usePreferences();
  useEffect(() => read(undefined), [read]);
  useEffect(() => {
    Uniwind.setTheme(preferences.theme);
  }, [preferences.theme]);
  const { theme } = useUniwind();
  const [background, foreground, border] = useCSSVariable([
    '--background',
    '--foreground',
    '--border',
  ]);
  const nativeTheme = theme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...nativeTheme,
        colors: {
          ...nativeTheme.colors,
          background: themeColor(background, nativeTheme.colors.background),
          card: themeColor(background, nativeTheme.colors.card),
          text: themeColor(foreground, nativeTheme.colors.text),
          border: themeColor(border, nativeTheme.colors.border),
        },
      }}
    >
      <ShellStartup />
    </ThemeProvider>
  );
}
