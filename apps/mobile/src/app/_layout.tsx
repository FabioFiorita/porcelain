import { List, Section, Text } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { ObserveRoot } from 'expo-observe'
import { type Href, router, usePathname } from 'expo-router'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { Stack } from 'expo-router/stack'
import { SplitView } from 'expo-router/unstable-split-view'
import { Platform, useColorScheme } from 'react-native'

import { ListLinkRow } from '@/components/list-link-row'
import { ScreenHost } from '@/components/screen-host'
import { CompanionScreen } from '@/features/companion/companion-screen'
import { FilesSplitColumn } from '@/features/files/files-screen'
import { DaemonProvider } from '@/lib/daemon/provider'

/**
 * Shared sheet chrome: form sheet, grabber, material background, room to see the surface
 * underneath. Header content is owned by each sheet.
 */
const SHEET = {
  contentStyle: { backgroundColor: 'transparent' },
  presentation: 'formSheet',
  sheetAllowedDetents: [0.7, 1.0] as number[],
  sheetGrabberVisible: true,
} as const

function RootLayout(): React.JSX.Element {
  const colorScheme = useColorScheme()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DaemonProvider>
        <RootNavigation />
      </DaemonProvider>
    </ThemeProvider>
  )
}

function RootNavigation(): React.JSX.Element {
  if ('isPad' in Platform && Platform.isPad) return <IPadShell />

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="repo" options={{ ...SHEET, headerShown: false }} />
      <Stack.Screen name="companion" options={{ ...SHEET, title: 'Companion' }} />
      <Stack.Screen name="settings" options={{ ...SHEET, headerShown: false }} />
    </Stack>
  )
}

/**
 * iPad is a full workstation alternative to the Mac app / browser — three columns +
 * inspector companion, no bottom tab bar. Phone remains the companion form factor.
 *
 * Expo SplitView is root-only (cannot nest). Primary = destinations, supplementary =
 * list for the active destination, secondary (Slot) = detail route, inspector = Companion.
 */
function IPadShell(): React.JSX.Element {
  return (
    <SplitView
      preferredDisplayMode="twoBesideSecondary"
      preferredSplitBehavior="tile"
      showInspector
      topColumnForCollapsing="primary"
    >
      <SplitView.Column>
        <IPadPrimaryColumn />
      </SplitView.Column>
      <SplitView.Column>
        <IPadSupplementaryColumn />
      </SplitView.Column>
      <SplitView.Inspector>
        <CompanionScreen embedded />
      </SplitView.Inspector>
    </SplitView>
  )
}

function IPadPrimaryColumn(): React.JSX.Element {
  const pathname = usePathname()

  return (
    <ScreenHost>
      <List modifiers={[listStyle('sidebar')]}>
        <Section title="Porcelain">
          <IPadDestination
            active={pathname.includes('(files)') || pathname === '/'}
            href="/(tabs)/(files)"
            label="Files"
            systemImage="folder.fill"
          />
          <IPadDestination
            active={pathname.includes('(changes)') && !pathname.includes('history')}
            href="/(tabs)/(changes)"
            label="Changes"
            systemImage="arrow.triangle.branch"
          />
          <IPadDestination
            active={pathname.includes('history')}
            href="/(tabs)/(changes)/history"
            label="History"
            systemImage="clock.arrow.circlepath"
          />
          <IPadDestination
            active={pathname.includes('(review)') && !pathname.includes('board')}
            href="/(tabs)/(review)"
            label="Review"
            systemImage="checkmark.seal.fill"
          />
          <IPadDestination
            active={pathname.includes('board')}
            href="/(tabs)/(review)/board"
            label="Board"
            systemImage="rectangle.3.group.fill"
          />
          <IPadDestination
            active={pathname.includes('(terminal)')}
            href="/(tabs)/(terminal)"
            label="Terminal"
            systemImage="terminal.fill"
          />
        </Section>
        <Section title="Chrome">
          <IPadDestination
            active={pathname.includes('/settings')}
            href="/settings"
            label="Settings"
            systemImage="gearshape"
          />
          <IPadDestination
            active={pathname.includes('/repo')}
            href="/repo"
            label="Project"
            systemImage="folder"
          />
        </Section>
      </List>
    </ScreenHost>
  )
}

function IPadSupplementaryColumn(): React.JSX.Element {
  const pathname = usePathname()

  if (pathname.includes('(files)')) {
    return <FilesSplitColumn />
  }

  return (
    <ScreenHost>
      <List modifiers={[listStyle('sidebar')]}>
        <Section>
          <Text>
            {pathname.includes('(changes)')
              ? 'Open a change from the main column, or pick History in the sidebar.'
              : pathname.includes('(review)')
                ? 'The Review canvas and Board open in the main column.'
                : pathname.includes('(terminal)')
                  ? 'Sessions open in the main column.'
                  : 'Select a destination.'}
          </Text>
        </Section>
      </List>
    </ScreenHost>
  )
}

function IPadDestination({
  active,
  href,
  label,
  systemImage,
}: {
  active: boolean
  href: Href
  label: string
  systemImage: string
}): React.JSX.Element {
  return (
    <ListLinkRow
      detail={active ? 'Selected' : undefined}
      icon={systemImage}
      label={label}
      onPress={(): void => {
        router.replace(href)
      }}
    />
  )
}

export default ObserveRoot.wrap(RootLayout)
