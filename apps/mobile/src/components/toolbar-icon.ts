import type { StackToolbarButtonProps } from 'expo-router'

/** Every icon the app puts in a native stack toolbar. */
export type ToolbarIconName =
  | 'companion'
  | 'history'
  | 'close'
  | 'add'
  | 'read'
  | 'bolt'
  | 'board'
  | 'comment'
  | 'evidence'
  | 'more'
  | 'settings'
  | 'filter'

type ToolbarIcon = NonNullable<StackToolbarButtonProps['icon']>

/**
 * The client is iOS-only, so a toolbar icon is always an SF Symbol name and
 * `Stack.Toolbar.Button` takes it directly. Keep the indirection anyway: call
 * sites name the icon, this file owns the symbol, so a rename is one edit.
 */
const SF_SYMBOLS: Record<ToolbarIconName, ToolbarIcon> = {
  companion: 'sidebar.right',
  history: 'clock.arrow.circlepath',
  read: 'text.alignleft',
  close: 'xmark',
  add: 'plus',
  bolt: 'bolt',
  board: 'rectangle.3.group.fill',
  comment: 'text.bubble',
  evidence: 'checkmark.seal',
  more: 'ellipsis',
  settings: 'gearshape',
  filter: 'line.3.horizontal.decrease.circle',
} as const satisfies Record<ToolbarIconName, ToolbarIcon>

export function toolbarIcon(name: ToolbarIconName): ToolbarIcon {
  return SF_SYMBOLS[name]
}
