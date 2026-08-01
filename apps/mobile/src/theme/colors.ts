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
  return accentColor(useColorScheme() === 'dark' ? 'dark' : 'light')
}

/**
 * Git status tints, mirroring the renderer's `changes-list.tsx` mapping (success/warning/
 * destructive/info) in iOS system colours so both clients tell the same story about a file.
 */
const STATUS_TINTS = {
  added: '#34C759',
  deleted: '#FF3B30',
  modified: '#FF9500',
  renamed: ACCENT.dark,
  untracked: '#34C759',
} as const

export function statusTint(status: keyof typeof STATUS_TINTS | undefined): string {
  return status === undefined ? STATUS_TINTS.modified : STATUS_TINTS[status]
}

/** Diff line backgrounds. Deep enough to read over the list background, light enough that
 *  monospaced text on top keeps system contrast in both appearances. */
const DIFF_BACKGROUNDS = {
  dark: { add: '#15321F', del: '#3A1A1C' },
  light: { add: '#E4F5E9', del: '#FDE7E7' },
} as const

export type AppearanceScheme = 'light' | 'dark'

export function diffBackgrounds(scheme: AppearanceScheme): { add: string; del: string } {
  return DIFF_BACKGROUNDS[scheme]
}

export function accentColor(scheme: AppearanceScheme): string {
  return ACCENT[scheme]
}

export function useDiffBackgrounds(): { add: string; del: string } {
  return diffBackgrounds(useColorScheme() === 'dark' ? 'dark' : 'light')
}
