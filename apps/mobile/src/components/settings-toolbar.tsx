import { router, Stack } from 'expo-router'

import { toolbarIcon } from '@/components/toolbar-icon'

/**
 * Header gear that opens the Settings sheet. Every `Stack.Toolbar.*` element has
 * to be created inside the component that renders `Stack.Toolbar`, so tabs that
 * need extra header buttons declare their own toolbar instead of composing this.
 */
export function SettingsToolbar(): React.JSX.Element {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        accessibilityLabel="Settings"
        icon={toolbarIcon('settings')}
        onPress={(): void => router.push('/settings')}
      />
    </Stack.Toolbar>
  )
}
