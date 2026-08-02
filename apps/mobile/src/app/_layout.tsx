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
import { FilesSplitColumn } from '@/features/files/files-screen'
import { DaemonProvider } from '@/lib/daemon/provider'

/**
 * Every sheet in the app is the same form sheet — grabber, transparent content so the
 * sheet's own material shows through, and detents that leave the surface behind it visible.
 * Only the header differs, and each sheet owns that.
 */
const SHEET = {
  contentStyle: { backgroundColor: 'transparent' },
  presentation: 'formSheet',
  // Not `as const`: the native stack takes a mutable `number[]` here.
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
  if ('isPad' in Platform && Platform.isPad) return <IPadSplitView />

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Repo remains a sheet because it is a contextual project picker. */}
      <Stack.Screen name="repo" options={{ ...SHEET, headerShown: false }} />
      <Stack.Screen name="companion" options={{ ...SHEET, title: 'Companion' }} />
    </Stack>
  )
}

function IPadSplitView(): React.JSX.Element {
  return (
    <SplitView
      preferredDisplayMode="twoBesideSecondary"
      preferredSplitBehavior="tile"
      topColumnForCollapsing="supplementary"
    >
      <SplitView.Column>
        <IPadNavigationColumn />
      </SplitView.Column>
      <SplitView.Column>
        <FilesSplitColumn />
      </SplitView.Column>
    </SplitView>
  )
}

function IPadNavigationColumn(): React.JSX.Element {
  const pathname = usePathname()

  return (
    <ScreenHost>
      <List modifiers={[listStyle('sidebar')]}>
        <Section title="Porcelain">
          <IPadDestination
            active={pathname.includes('(files)') || pathname === '/'}
            href="/(tabs)/(files)"
            label="Files"
          />
          <IPadDestination
            active={pathname.includes('(changes)')}
            href="/(tabs)/(changes)"
            label="Changes"
          />
          <IPadDestination
            active={pathname.includes('(board)')}
            href="/(tabs)/(board)"
            label="Board"
          />
          <IPadDestination
            active={pathname.includes('(terminal)')}
            href="/(tabs)/(terminal)"
            label="Terminal"
          />
          <IPadDestination
            active={pathname.includes('/settings')}
            href="/(tabs)/settings"
            label="Settings"
          />
        </Section>
        <Section>
          <Text>Repository and companion actions stay in the shared route table.</Text>
        </Section>
      </List>
    </ScreenHost>
  )
}

function IPadDestination({
  active,
  href,
  label,
}: {
  active: boolean
  href: Href
  label: string
}): React.JSX.Element {
  return (
    <ListLinkRow
      detail={active ? 'Selected' : undefined}
      label={label}
      onPress={(): void => {
        router.replace(href)
      }}
    />
  )
}

// EAS Observe: measures time to first render for cold and warm launches. Deliberately WITHOUT
// `Observe.configure({ integrations: { 'expo-router': true } })` — per-route navigation metrics
// only surface in the Navigation events dashboard, which this account's plan does not include,
// so the integration would ship data nobody can read. Turn it on (module scope, before the first
// screen mounts) if the plan changes. The startup TTI each entry screen marks IS free-tier.
export default ObserveRoot.wrap(RootLayout)
