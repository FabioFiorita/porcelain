import { List, Section, Text } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { ObserveRoot } from 'expo-observe'
import { type Href, router } from 'expo-router'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { Stack } from 'expo-router/stack'
import { SplitView } from 'expo-router/unstable-split-view'
import { Platform, useColorScheme } from 'react-native'

import { ListLinkRow } from '@/components/list-link-row'
import { ScreenHost } from '@/components/screen-host'
import { ChangesSplitColumn } from '@/features/changes/changes-screen'
import { HistorySplitColumn } from '@/features/changes/history-screen'
import { CompanionScreen } from '@/features/companion/companion-screen'
import { FilesSplitColumn } from '@/features/files/files-screen'
import { DaemonProvider } from '@/lib/daemon/provider'
import { type IPadDestination, useIPadDestination } from '@/lib/ipad-destination'
import { useTabFaces } from '@/lib/tab-faces'

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
  const destination = useIPadDestination((state) => state.destination)

  return (
    <ScreenHost>
      <List modifiers={[listStyle('sidebar')]}>
        <Section title="Porcelain">
          <IPadNavRow
            active={destination === 'files'}
            destination="files"
            href="/(tabs)/(files)"
            label="Files"
            systemImage="folder.fill"
          />
          <IPadNavRow
            active={destination === 'changes'}
            destination="changes"
            href="/(tabs)/(changes)"
            label="Changes"
            onNavigate={(): void => {
              useTabFaces.getState().setChanges('changes')
            }}
            systemImage="arrow.triangle.branch"
          />
          <IPadNavRow
            active={destination === 'history'}
            destination="history"
            href="/(tabs)/(changes)"
            label="History"
            onNavigate={(): void => {
              useTabFaces.getState().setChanges('history')
            }}
            systemImage="clock.arrow.circlepath"
          />
          <IPadNavRow
            active={destination === 'review'}
            destination="review"
            href="/(tabs)/(review)"
            label="Review"
            onNavigate={(): void => {
              useTabFaces.getState().setReview('review')
            }}
            systemImage="checkmark.seal.fill"
          />
          <IPadNavRow
            active={destination === 'board'}
            destination="board"
            href="/(tabs)/(review)"
            label="Board"
            onNavigate={(): void => {
              useTabFaces.getState().setReview('board')
            }}
            systemImage="rectangle.3.group.fill"
          />
          <IPadNavRow
            active={destination === 'terminal'}
            destination="terminal"
            href="/(tabs)/(terminal)"
            label="Terminal"
            systemImage="terminal.fill"
          />
        </Section>
        <Section title="Chrome">
          <IPadNavRow
            active={destination === 'settings'}
            destination="settings"
            href="/settings"
            label="Settings"
            systemImage="gearshape"
          />
          <IPadNavRow
            active={destination === 'repo'}
            destination="repo"
            href="/repo"
            label="Project"
            systemImage="folder"
          />
        </Section>
      </List>
    </ScreenHost>
  )
}

/**
 * Middle column: the list for the active destination. The secondary Slot (main) is the
 * detail — open file, commit, session — or an empty placeholder on the tab root.
 */
function IPadSupplementaryColumn(): React.JSX.Element {
  const destination = useIPadDestination((state) => state.destination)

  if (destination === 'files') {
    return <FilesSplitColumn />
  }

  if (destination === 'changes') {
    return <ChangesSplitColumn />
  }

  if (destination === 'history') {
    return <HistorySplitColumn />
  }

  // Review / Board / Terminal are canvases (or not yet list-extracted). Keep a short
  // sidebar note so the three-column shell stays stable while those deepen.
  const note =
    destination === 'review' || destination === 'board'
      ? 'Review and Board open in the main column.'
      : destination === 'terminal'
        ? 'Sessions open in the main column.'
        : 'Select a destination in the sidebar.'

  return (
    <ScreenHost>
      <List modifiers={[listStyle('sidebar')]}>
        <Section>
          <Text>{note}</Text>
        </Section>
      </List>
    </ScreenHost>
  )
}

function IPadNavRow({
  active,
  destination,
  href,
  label,
  onNavigate,
  systemImage,
}: {
  active: boolean
  destination: IPadDestination
  href: Href
  label: string
  onNavigate?: () => void
  systemImage: string
}): React.JSX.Element {
  return (
    <ListLinkRow
      detail={active ? 'Selected' : undefined}
      icon={systemImage}
      label={label}
      onPress={(): void => {
        useIPadDestination.getState().setDestination(destination)
        onNavigate?.()
        router.replace(href)
      }}
    />
  )
}

export default ObserveRoot.wrap(RootLayout)
