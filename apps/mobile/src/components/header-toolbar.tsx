import { type Href, router, Stack } from 'expo-router'

import { type ToolbarIconName, toolbarIcon } from '@/components/toolbar-icon'

/** A push the screen owns, sitting before the companion / settings buttons. */
export type ScreenAction = {
  href: Href
  icon: ToolbarIconName
  label: string
}

/**
 * Trailing header controls. Order is fixed: surface actions → companion → settings.
 * Companion is the right-rail analogue (sheet on phone, inspector on iPad). Settings is
 * chrome, never a tab.
 */
export function HeaderToolbar({
  actions = [],
  companion,
  showSettings = true,
}: {
  actions?: readonly ScreenAction[]
  companion?: ScreenAction | null
  showSettings?: boolean
}): React.JSX.Element | null {
  const companionAction: ScreenAction | null =
    companion === undefined
      ? {
          href: '/companion',
          icon: 'companion',
          label: 'Companion',
        }
      : companion

  if (actions.length === 0 && companionAction === null && !showSettings) return null

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
      {showSettings ? (
        <Stack.Toolbar.Button
          accessibilityLabel="Settings"
          icon={toolbarIcon('settings')}
          onPress={(): void => router.push('/settings')}
        />
      ) : null}
    </Stack.Toolbar>
  )
}
