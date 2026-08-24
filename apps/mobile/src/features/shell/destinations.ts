import type { Href } from 'expo-router'

import type { ChromeIconName } from '@/components/chrome-glyph'

/**
 * The three things the app is, named once for both shells.
 *
 * The phone spends them on a bottom bar and the tablet spends them on sidebar rows, but they
 * are the same three `expo-router` tabs underneath: one navigator, one set of stacks, one place
 * that says what a destination is called and what it is drawn with. Two lists would be two
 * chances to disagree about which tab `terminals` is.
 */
export type Destination = {
  /** `TabTrigger`'s name — the handle a trigger outside the `TabList` switches by. */
  readonly name: string
  /** The route the trigger resolves to; typed so a renamed route fails the build here. */
  readonly href: Href
  readonly label: string
  readonly glyph: ChromeIconName
}

export const DESTINATIONS: readonly Destination[] = [
  { name: 'hub', href: '/', label: 'Worktrees', glyph: 'layers' },
  { name: 'terminals', href: '/terminals', label: 'Terminals', glyph: 'terminal' },
  { name: 'settings', href: '/settings', label: 'Settings', glyph: 'settings' },
]
