import type { StackToolbarButtonProps } from 'expo-router'

/** Every icon the app puts in a native stack toolbar. */
export type ToolbarIconName =
  | 'overflow'
  | 'settings'
  | 'companion'
  | 'board'
  | 'history'
  | 'close'
  | 'add'

type ToolbarIcon = NonNullable<StackToolbarButtonProps['icon']>

/**
 * The client is iOS-only, so a toolbar icon is always an SF Symbol name and
 * `Stack.Toolbar.Button` takes it directly. Keep the indirection anyway: call
 * sites name the icon, this file owns the symbol, so a rename is one edit.
 *
 * `overflow` opens the menu (iOS reads a bare `ellipsis` as "more"); `settings`
 * is the gear on the row inside it, naming a destination rather than an act.
 */
const SF_SYMBOLS: Record<ToolbarIconName, ToolbarIcon> = {
  overflow: 'ellipsis',
  settings: 'gearshape',
  companion: 'sidebar.right',
  board: 'rectangle.3.group',
  history: 'clock.arrow.circlepath',
  close: 'xmark',
  add: 'plus',
} as const satisfies Record<ToolbarIconName, ToolbarIcon>

export function toolbarIcon(name: ToolbarIconName): ToolbarIcon {
  return SF_SYMBOLS[name]
}
