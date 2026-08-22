import * as DropdownMenuPrimitive from '@rn-primitives/dropdown-menu'
import * as Slot from '@rn-primitives/slot'
import type { PressableProps } from 'react-native'
import { View } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

/**
 * One item in a row's context menu.
 *
 * Deliberately the same shape as `SheetAction` in `panel-chrome`: the two are the same idea
 * reached two ways — a long press on a row — so a surface moving from the action sheet to the
 * menu can hand over the array it already builds.
 */
/** See `Sheet`'s `FILL` — a registered style is dropped by the class merge. */
const FILL = { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 } as const

export type RowMenuAction = {
  id: string
  label: string
  glyph?: ChromeIconName
  /** Red label, the way the web client's `ContextMenuItem` marks a destructive verb. */
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}

/**
 * A list row that opens its context menu on long press.
 *
 * This was the platform's menu — SwiftUI's `ContextMenu` on iOS, an anchored Material
 * `DropdownMenu` on Android, both through `@expo/ui`. It looked like neither the app nor,
 * really, the platform: the iOS half had to rebuild the row inside a `Host` to keep its width,
 * the Android half could not draw our icons at all (a Material menu wants a drawable resource,
 * not a Material Symbols name), and the items came out in the system's type on the system's
 * fill next to a row painted from tokens.
 *
 * `@rn-primitives/dropdown-menu` is the React Native Reusables primitive behind the web
 * client's own `ContextMenu`, so the two clients now draw the same menu from the same tokens:
 * a `rounded-xl bg-popover` card with a hairline, `min-h-11` items, and `text-destructive` on
 * the verbs that cannot be undone. Icons work on both platforms, because they are ours.
 *
 * The row stays fully interactive — a tap still does the row's own thing; only the long press
 * belongs to this.
 */
export function RowContextMenu({
  actions,
  children,
  testID,
  title,
}: {
  actions: readonly RowMenuAction[]
  /** The row itself. */
  children: React.ReactNode
  testID?: string
  /** Heading above the items. */
  title?: string
}): React.JSX.Element {
  return (
    <MenuRoot actions={actions} testID={testID} title={title}>
      <DropdownMenuPrimitive.Trigger asChild testID={testID}>
        <LongPressTrigger>{children}</LongPressTrigger>
      </DropdownMenuPrimitive.Trigger>
    </MenuRoot>
  )
}

/**
 * The same menu on a plain TAP, anchored to whatever opened it.
 *
 * For a control whose only job is to open a menu — the Surfaces strip's `+`, a tab's own menu on
 * a pointer-less screen. A bottom sheet is the right presentation when the trigger is a row in a
 * list a thumb is already on; anchored to a 36pt button at the top of a 320pt panel in a 1200pt
 * window, a sheet spanning the whole window to list four items is the phone shape stretched,
 * which is the thing this pass exists to stop doing.
 */
export function AnchoredMenu({
  actions,
  children,
  testID,
  title,
}: {
  actions: readonly RowMenuAction[]
  /** The control that opens it. */
  children: React.ReactNode
  testID?: string
  title?: string
}): React.JSX.Element {
  return (
    <MenuRoot actions={actions} testID={testID} title={title}>
      <DropdownMenuPrimitive.Trigger asChild testID={testID}>
        <Slot.Pressable>{children}</Slot.Pressable>
      </DropdownMenuPrimitive.Trigger>
    </MenuRoot>
  )
}

/** Root, portal, overlay and the item list — everything except which gesture opens it. */
function MenuRoot({
  actions,
  children,
  testID,
  title,
}: {
  actions: readonly RowMenuAction[]
  children: React.ReactNode
  testID?: string
  title?: string
}): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Root>
      {children}
      <DropdownMenuPrimitive.Portal>
        {/* `FILL` and no `asChild`, for the reason `Sheet` spells out: the portal host renders a
            fragment, so the overlay has to be told to fill, and a reanimated view would drop
            every class it was given. */}
        <DropdownMenuPrimitive.Overlay style={FILL}>
          {/* `asChild` so the class list is on OUR view: a class handed to a component from
              `node_modules` is an inert prop — see the note in `Sheet`. */}
          <DropdownMenuPrimitive.Content
            asChild
            insets={{ bottom: 12, left: 12, right: 12, top: 12 }}
          >
            <View
              className="min-w-56 rounded-xl border border-border bg-popover p-1 shadow-lg shadow-black/20"
              testID={testID === undefined ? undefined : `${testID}-menu`}
            >
              {title === undefined ? null : (
                <Text className="px-2 py-1.5 text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {title}
                </Text>
              )}
              {actions.map((action) => (
                <DropdownMenuPrimitive.Item
                  key={action.id}
                  asChild
                  disabled={action.disabled === true}
                  onPress={action.onPress}
                >
                  <View
                    className={cn(
                      'min-h-11 flex-row items-center gap-3 rounded-lg px-2 active:bg-accent',
                      action.disabled === true && 'opacity-40',
                    )}
                    testID={`${testID ?? 'porcelain-row-menu'}-${action.id}`}
                  >
                    {action.glyph === undefined ? null : (
                      <ChromeGlyph
                        name={action.glyph}
                        size={15}
                        tone={action.destructive === true ? 'destructive' : 'foreground'}
                      />
                    )}
                    <Text
                      className={cn(
                        'min-w-0 flex-1 text-sm font-medium',
                        action.destructive === true ? 'text-destructive' : 'text-foreground',
                      )}
                    >
                      {action.label}
                    </Text>
                  </View>
                </DropdownMenuPrimitive.Item>
              ))}
            </View>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Overlay>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}

/**
 * The trigger, moved from tap to LONG press — and merged INTO the row rather than wrapped
 * around it.
 *
 * `DropdownMenuPrimitive.Trigger` opens on press, which is the wrong gesture: a tap on these
 * rows opens the Worktree or the terminal session. Remapping it is not enough on its own — a
 * first cut wrapped the row in a second `Pressable`, and the row's own one won every touch, so
 * the long press never arrived and a slow press just opened the Worktree.
 *
 * `Slot.Pressable` clones the ROW with these props instead of nesting a pressable around it.
 * Its merge composes handlers rather than replacing them, so the row keeps its `onPress` and
 * gains an `onLongPress` — one pressable, two gestures, and the trigger's ref still reaches the
 * row so the menu can anchor to it.
 */
function LongPressTrigger({ children, onPress, ...props }: PressableProps): React.JSX.Element {
  return (
    <Slot.Pressable {...props} delayLongPress={350} onLongPress={onPress}>
      {children}
    </Slot.Pressable>
  )
}
