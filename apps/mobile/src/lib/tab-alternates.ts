import type { Href } from 'expo-router'

/**
 * Tab bar long-press / re-tap alternates. NativeTabs has no long-press menu API yet, so the
 * phone shell uses (1) re-tap while focused → push the alternate, and (2) an explicit header
 * menu on those tabs. Same destinations either way.
 *
 * | Primary tab | Alternate |
 * |-------------|-----------|
 * | Changes     | History   |
 * | Review      | Board     |
 */
export const TAB_ALTERNATES = {
  changes: {
    href: '/history' as Href,
    label: 'History',
    symbol: 'clock.arrow.circlepath',
  },
  review: {
    href: '/board' as Href,
    label: 'Board',
    symbol: 'rectangle.3.group.fill',
  },
} as const

export type TabWithAlternate = keyof typeof TAB_ALTERNATES
