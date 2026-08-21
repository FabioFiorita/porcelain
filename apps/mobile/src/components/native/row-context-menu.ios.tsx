import { Button, ContextMenu, Host, RNHostView, Section } from '@expo/ui/swift-ui'
import { disabled as disabledModifier } from '@expo/ui/swift-ui/modifiers'

import { sfSymbolFor } from '@/components/chrome-glyph'

import type { RowMenuAction } from './row-menu-actions'

export type { RowMenuAction } from './row-menu-actions'

/**
 * The iOS half of `RowContextMenu` — SwiftUI's own `ContextMenu`, hosting the row.
 *
 * `@expo/ui`'s `MenuView` builds this same tree, but it hosts it with `matchContents` on BOTH
 * axes, and that is what collapsed every row that wore it down to ~18pt: `HostView` applies
 * `.fixedSize(horizontal:)` and then writes the width SwiftUI measured back onto the Yoga node
 * as an explicit STYLE width, while `RNHostView` sizes the SwiftUI content from that same
 * node's bounds. The two feed each other, so the row is measured with no width to fill, its
 * `flex-1` column resolves to zero, and the fixed point is the leading glyph plus the chevron.
 * Nothing outside can undo it: the host pins its OWN node, so a full width handed to it from the
 * swipeable's containers changes nothing, and one written on the host itself is overwritten by
 * the next `setStyleSize`. That is why every `width: '100%'` tried here looked like a no-op.
 *
 * So the host matches contents VERTICALLY only. Height still comes from the row — a list row
 * has no intrinsic height the parent can know — and width arrives the ordinary way, by
 * stretching to the list. Android needs none of this: its `MenuView` wraps the Compose host in
 * a plain `View`, which stretches, so `row-context-menu.tsx` stays as it was.
 *
 * `matchContents` is read once, when the native host is created, so a Fast Refresh cannot repair a
 * host that is already on screen: the JavaScript arrives and the SwiftUI view keeps the sizing it
 * was born with. That is what made this fix look partial. The Terminals rows, mounted before it
 * landed, stayed 18pt wide through every reload while the Hub rows that happened to remount came
 * back full width — one bug reading as two, and a scroll parent taking the blame. Measured on an
 * iPad Pro 13-inch, `snapshot-ui` frames for a session row: both axes matched, cold launch, 18x48;
 * this file's shape, cold launch, 1016x48; this file's shape delivered by Fast Refresh alone,
 * 18x48 still. Relaunch the app before believing a row is still collapsed.
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
  // Composed here rather than through `rowMenuActions`, because SwiftUI takes the handler
  // itself: there is no native identifier to route back through.
  const items = actions.map((action) => (
    <Button
      key={action.id}
      label={action.label}
      modifiers={action.disabled === true ? [disabledModifier(true)] : undefined}
      role={action.destructive === true ? 'destructive' : undefined}
      systemImage={action.glyph === undefined ? undefined : sfSymbolFor(action.glyph)}
      onPress={action.onPress}
    />
  ))

  return (
    <Host
      ignoreSafeArea="all"
      matchContents={{ horizontal: false, vertical: true }}
      testID={testID}
    >
      <ContextMenu>
        <ContextMenu.Trigger>
          <RNHostView matchContents>
            {/* biome-ignore lint/complexity/noUselessFragments: `RNHostView` hosts exactly one
                element, and a row is a `ReactNode` */}
            <>{children}</>
          </RNHostView>
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {title === undefined ? items : <Section title={title}>{items}</Section>}
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  )
}
