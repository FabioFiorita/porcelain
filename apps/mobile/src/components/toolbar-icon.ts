import type { StackToolbarButtonProps } from 'expo-router'

/** Every icon the app puts in a native stack toolbar. */
export type ToolbarIconName = 'settings' | 'board' | 'history'

type ToolbarIcon = NonNullable<StackToolbarButtonProps['icon']>

/**
 * The client is iOS-only, so a toolbar icon is always an SF Symbol name and
 * `Stack.Toolbar.Button` takes it directly. Keep the indirection anyway: call
 * sites name the icon, this file owns the symbol — so the set of header icons
 * stays readable in one place and a symbol rename is one edit.
 */
const SF_SYMBOLS = {
  settings: 'gearshape',
  board: 'rectangle.3.group',
  history: 'clock.arrow.circlepath',
} as const satisfies Record<ToolbarIconName, ToolbarIcon>

export function toolbarIcon(name: ToolbarIconName): ToolbarIcon {
  return SF_SYMBOLS[name]
}
