import type { StackToolbarButtonProps } from 'expo-router'

/** Every icon the app puts in a native stack toolbar. */
export type ToolbarIconName = 'settings' | 'companion' | 'history' | 'close' | 'add' | 'read'

type ToolbarIcon = NonNullable<StackToolbarButtonProps['icon']>

/**
 * The client is iOS-only, so a toolbar icon is always an SF Symbol name and
 * `Stack.Toolbar.Button` takes it directly. Keep the indirection anyway: call
 * sites name the icon, this file owns the symbol, so a rename is one edit.
 *
 * `settings` is an ellipsis, not a gear: iOS reads a bare `ellipsis` as "more",
 * and it is the only header button that is not about the current screen.
 */
const SF_SYMBOLS: Record<ToolbarIconName, ToolbarIcon> = {
  settings: 'ellipsis',
  companion: 'sidebar.right',
  history: 'clock.arrow.circlepath',
  read: 'text.alignleft',
  close: 'xmark',
  add: 'plus',
} as const satisfies Record<ToolbarIconName, ToolbarIcon>

export function toolbarIcon(name: ToolbarIconName): ToolbarIcon {
  return SF_SYMBOLS[name]
}
