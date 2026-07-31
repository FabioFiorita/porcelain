import { Button, Host, List, Text, VStack } from '@expo/ui/swift-ui'
import { font, foregroundStyle, listStyle } from '@expo/ui/swift-ui/modifiers'
import { type Href, router, Stack } from 'expo-router'

import { colors } from '@/theme/colors'

const ROWS = [
  {
    href: '/settings/environments',
    subtitle: 'Daemons paired with this device',
    title: 'Environments',
  },
  { href: '/settings/appearance', subtitle: 'Theme and density', title: 'Appearance' },
  { href: '/settings/about', subtitle: 'Version and links', title: 'About' },
] as const satisfies readonly { href: Href; subtitle: string; title: string }[]

export function SettingsScreen() {
  return (
    <>
      <Host seedColor={colors.tint} style={{ flex: 1 }} useViewportSizeMeasurement>
        {/*
          `Button` wrapping a `VStack` is the SwiftUI title+subtitle row. There is
          no `NavigationLink` here on purpose: expo-router owns navigation, so the
          row only needs to fire `router.push`.
        */}
        <List modifiers={[listStyle('insetGrouped')]}>
          {ROWS.map(({ href, subtitle, title }) => (
            <Button key={title} onPress={() => router.push(href)}>
              <VStack alignment="leading" spacing={2}>
                <Text>{title}</Text>
                <Text
                  modifiers={[
                    font({ textStyle: 'footnote' }),
                    foregroundStyle({ style: 'secondary', type: 'hierarchical' }),
                  ]}
                >
                  {subtitle}
                </Text>
              </VStack>
            </Button>
          ))}
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
