import { Host, List, ListItem } from '@expo/ui'
import { router, Stack } from 'expo-router'

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
      {/* The form sheet has no navigation bar, so this is its dismiss affordance. */}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button onPress={() => router.back()} variant="done">
          Done
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  )
}
