import { useEffect, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { VariableContextProvider } from 'react-native-css/native'

import { applyTheme, usePreferencesStore } from './preferences-store'
import { DARK_THEME_VARS, LIGHT_THEME_VARS } from './theme-vars'

/**
 * Resolves Appearance preference → concrete light/dark, drives CSS variables for
 * the whole tree, and keeps Appearance/colorScheme in sync for StatusBar + icons.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const theme = usePreferencesStore((state) => state.theme)
  const hydrated = usePreferencesStore((state) => state.hydrated)
  const hydrate = usePreferencesStore((state) => state.hydrate)
  const systemScheme = useColorScheme()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  // When preference is `system`, keep CSS/Appearance aligned with OS flips.
  useEffect(() => {
    if (!hydrated || theme !== 'system') return
    // Read systemScheme so this re-runs when the OS appearance changes.
    void systemScheme
    applyTheme('system')
  }, [hydrated, systemScheme, theme])

  const resolved: 'light' | 'dark' =
    theme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : theme

  const variables = useMemo(
    () => (resolved === 'dark' ? DARK_THEME_VARS : LIGHT_THEME_VARS),
    [resolved],
  )

  return (
    <VariableContextProvider key={resolved} value={variables}>
      {children}
    </VariableContextProvider>
  )
}

export function useResolvedColorScheme(): 'light' | 'dark' {
  const theme = usePreferencesStore((state) => state.theme)
  const systemScheme = useColorScheme()
  if (theme === 'system') return systemScheme === 'dark' ? 'dark' : 'light'
  return theme
}
