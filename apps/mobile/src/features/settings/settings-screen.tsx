import { Button, Host, List, Text, VStack } from '@expo/ui/swift-ui'
import { buttonStyle, font, foregroundStyle, listStyle } from '@expo/ui/swift-ui/modifiers'
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
        {/* `buttonStyle('plain')` is required — a default SwiftUI Button tints its whole label with the accent color. */}
        <List modifiers={[listStyle('insetGrouped')]}>
          {ROWS.map(({ href, subtitle, title }) => (
            <Button
              key={title}
              modifiers={[buttonStyle('plain')]}
              onPress={() => router.push(href)}
            >
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
