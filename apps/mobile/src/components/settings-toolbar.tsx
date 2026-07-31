import { router, Stack } from 'expo-router'

import { toolbarIcon } from '@/components/toolbar-icon'

/**
 * Header gear that opens the Settings sheet. Every `Stack.Toolbar.*` element has
 * to be created inside the component that renders `Stack.Toolbar`, so tabs that
 * need extra header buttons declare their own toolbar instead of composing this.
 */
export function SettingsToolbar() {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        accessibilityLabel="Settings"
        icon={toolbarIcon('settings')}
        onPress={() => router.push('/settings')}
      />
    </Stack.Toolbar>
  )
}
