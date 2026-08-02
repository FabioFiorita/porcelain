import { type Href, router, Stack } from 'expo-router'

import { type ToolbarIconName, toolbarIcon } from '@/components/toolbar-icon'

/** A push the screen owns, sitting left of the two buttons every surface shares. */
export type ScreenAction = {
  href: Href
  icon: ToolbarIconName
  label: string
}

/**
 * The optional trailing buttons a surface exposes. Split out from `ScreenHeader` because a
 * pushed screen wants these without the custom title — a left header item would take the slot
 * the back button needs.
 *
 * The companion is last so the control for the right-hand panel sits on the right-hand edge.
 */
export function HeaderToolbar({
  actions = [],
  companion,
}: {
  actions?: readonly ScreenAction[]
  companion?: ScreenAction | null
}): React.JSX.Element | null {
  const companionAction: ScreenAction | null =
    companion === undefined
      ? {
          href: '/companion',
          icon: 'bolt',
          label: 'Companion',
        }
      : companion

  if (actions.length === 0 && companionAction === null) return null

  return (
    <Stack.Toolbar placement="right">
      {actions.map((action) => (
        <Stack.Toolbar.Button
          accessibilityLabel={action.label}
          icon={toolbarIcon(action.icon)}
          key={action.label}
          onPress={(): void => router.push(action.href)}
        />
      ))}
      {companionAction === null ? null : (
        <Stack.Toolbar.Button
          accessibilityLabel={companionAction.label}
          icon={toolbarIcon(companionAction.icon)}
          onPress={(): void => router.push(companionAction.href)}
        />
      )}
    </Stack.Toolbar>
  )
}
