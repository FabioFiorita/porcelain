import '../app.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useCSSVariable, useUniwind } from 'uniwind';
import { ShellStartup } from './shell-startup';
import { RegistryProvider, useAtomMount } from '@effect/atom-react';
import { preferenceTheme } from '../features/preferences';

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
  useAtomMount(preferenceTheme);
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
