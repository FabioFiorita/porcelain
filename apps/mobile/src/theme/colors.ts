import { useColorScheme } from 'react-native'

/**
 * The app's accent, tracking the desktop renderer's `--info` token — the blue it already
 * paints worktree dots, review inbox marks and status icons with. Desktop's `--primary`
 * is a darker button blue that reads muddy as an iOS tint over black, so the two clients
 * share the hue and not the shade.
 */
const ACCENT = {
  dark: '#00A6F4',
  light: '#0084D1',
} as const

/**
 * Accent for the current system appearance, feeding the tab bar tint and every
 * `@expo/ui/swift-ui` `Host` seed color so the app never drifts into two accents.
 * Appearance follows the phone and offers no override, so it is never a stored
 * preference — read the scheme, never persist it.
 */
export function useAccentColor(): string {
  return useColorScheme() === 'dark' ? ACCENT.dark : ACCENT.light
}
