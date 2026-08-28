import type { Href } from 'expo-router'

/**
 * The tab navigator's destinations, named once for both shells.
 *
 * Neither shell draws a bottom bar. The `TabList` is hidden and the tablet's Settings row is a
 * `TabTrigger` of the same `name`. `terminals` stays a tab so `/terminals` keeps its own stack
 * when something navigates there — it is not a sidebar or tab-bar row.
 */
export type Destination = {
  /** `TabTrigger`'s name — the handle a trigger outside the `TabList` switches by. */
  readonly name: string
  /** The route the trigger resolves to; typed so a renamed route fails the build here. */
  readonly href: Href
}

export const DESTINATIONS: readonly Destination[] = [
  { name: 'hub', href: '/' },
  { name: 'terminals', href: '/terminals' },
  { name: 'settings', href: '/settings' },
]
