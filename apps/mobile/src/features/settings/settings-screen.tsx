import { Host, List, ListItem } from '@expo/ui'
import { router, Stack } from 'expo-router'
import { Platform } from 'react-native'

import { colors } from '@/theme/colors'

export function SettingsScreen() {
  return (
    <>
      <Host seedColor={colors.tint} style={{ flex: 1 }} useViewportSizeMeasurement>
        <List>
          <ListItem
            onPress={() => router.push('/settings/environments')}
            supportingText="Daemons paired with this device"
          >
            Environments
          </ListItem>
          <ListItem
            onPress={() => router.push('/settings/appearance')}
            supportingText="Theme and density"
          >
            Appearance
          </ListItem>
          <ListItem
            onPress={() => router.push('/settings/about')}
            supportingText="Version and links"
          >
            About
          </ListItem>
        </List>
      </Host>
      {/*
        iOS only: this is the sheet's dismiss affordance. Android toolbar buttons
        render nothing without an image icon (label-only buttons are dropped), and
        the platform already gives this screen a native up arrow.
      */}
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button onPress={() => router.back()} variant="done">
            Done
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
    </>
  )
}
