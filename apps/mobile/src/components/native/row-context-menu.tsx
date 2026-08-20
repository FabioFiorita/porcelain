import { MenuView } from '@expo/ui/community/menu'

import { type RowMenuAction, rowMenuActions, rowMenuPress } from './row-menu-actions'

export type { RowMenuAction } from './row-menu-actions'

/**
 * A list row that opens the platform's own context menu on long press.
 *
 * On iOS this is `@expo/ui`'s SwiftUI `ContextMenu`: the row lifts, the rest of the screen
 * blurs, and the menu animates out of the row itself — the interaction the system uses
 * everywhere else, which no `Modal` full of `Pressable`s can imitate. On Android the same
 * declaration becomes an anchored Material `DropdownMenu`, which is that platform's answer to
 * the same gesture. `@expo/ui/swift-ui`'s `ContextMenu` alone would have covered only the first
 * of those.
 *
 * The Terminals list is its first consumer — rename and kill hang off a session row here. The
 * surfaces that still open `ActionSheet` on a long press have not moved yet; that is a change
 * to what those rows do rather than to what draws them.
 */
export function RowContextMenu({
  actions,
  children,
  testID,
  title,
}: {
  actions: readonly RowMenuAction[]
  /** The row itself. It stays fully interactive — a tap still does the row's own thing. */
  children: React.ReactNode
  testID?: string
  /** Heading above the items. iOS only; the Material menu has no title slot. */
  title?: string
}): React.JSX.Element {
  return (
    <MenuView
      actions={rowMenuActions(actions)}
      shouldOpenOnLongPress
      testID={testID}
      title={title}
      onPressAction={({ nativeEvent }) => {
        rowMenuPress(actions, nativeEvent.event)
      }}
    >
      {children}
    </MenuView>
  )
}
