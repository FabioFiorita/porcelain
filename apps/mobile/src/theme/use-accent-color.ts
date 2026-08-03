import { useColorScheme } from 'react-native'

import { accentColor } from '@/theme/colors'

/**
 * Accent for the current system appearance, feeding the tab bar tint and every
 * `@expo/ui/swift-ui` `Host` seed color so the app never drifts into two accents.
 * Appearance follows the phone and offers no override, so it is never a stored
 * preference — read the scheme, never persist it.
 */
export function useAccentColor(): string {
  return accentColor(useColorScheme() === 'dark' ? 'dark' : 'light')
}
