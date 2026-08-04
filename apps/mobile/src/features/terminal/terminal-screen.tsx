import { Button, ContentUnavailableView, List, Section, Text } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { ObserveInteractiveMarker } from 'expo-observe'
import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, useColorScheme } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import type { TerminalAction } from '@/lib/daemon/procedures/terminal'
import { useActiveRepo } from '@/lib/daemon/repo'
import { useDaemonSession } from '@/lib/daemon/session'

import { TerminalActionsSection } from './terminal-actions-section'
import { TerminalSessionRow } from './terminal-session-row'
import { TerminalLimitError, useTerminalActions } from './use-terminal-actions'
import { useTerminalSessions } from './use-terminal-sessions'

export function TerminalScreen(): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  useSurfaceFocus('terminal')

  return (
    <>
      <DaemonGate requires="repo">
        <TerminalBody onToggleShowAll={setShowAll} showAll={showAll} />
      </DaemonGate>
      {/* One trailing toolbar only — a second Stack.Toolbar replaces companion/settings. */}
      <ScreenHeader
        actions={[{ href: '/new', icon: 'add', label: 'Start a shell' }]}
        title="Terminal"
      />
      <ObserveInteractiveMarker />
    </>
  )
}

function TerminalBody({
  onToggleShowAll,
  showAll,
}: {
  onToggleShowAll: (value: boolean | ((current: boolean) => boolean)) => void
  showAll: boolean
}): React.JSX.Element {
  const repo = useActiveRepo()
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark'
  const session = useDaemonSession()
  const roster = useTerminalSessions(showAll)
  const actions = useTerminalActions()
  const [runningAction, setRunningAction] = useState<string | null>(null)

  function rename(id: string, current: string): void {
    Alert.prompt(
      'Rename terminal',
      'Choose the label shown in the roster.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: (value?: string): void => {
            roster.rename(id, value ?? current).catch((error: unknown) => {
              Alert.alert('Rename failed', error instanceof Error ? error.message : 'Try again.')
            })
          },
          text: 'Rename',
        },
      ],
      'plain-text',
      current,
    )
  }

  function kill(id: string, name: string): void {
    Alert.alert(`Kill ${name}?`, 'The process ends.', [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: (): void => roster.kill(id),
        style: 'destructive',
        text: 'Kill',
      },
    ])
  }

  async function runAction(action: Parameters<typeof actions.runAction>[0]): Promise<void> {
    setRunningAction(action.id)
    try {
      const id = await actions.runAction(action)
      router.push({ params: { id }, pathname: '/session/[id]' })
    } catch (error) {
      const message =
        error instanceof TerminalLimitError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'The Action could not start.'
      Alert.alert('Could not start terminal', message)
    } finally {
      setRunningAction(null)
    }
  }

  const contractError =
    roster.error?.kind === 'daemon-error' || roster.error?.kind === 'invalid-response'
  const disconnected = session.status !== 'open'

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        {disconnected ? (
          <Section>
            <Text>{session.status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</Text>
          </Section>
        ) : null}
        {contractError ? (
          <Section>
            <ContentUnavailableView
              description={roster.error?.message ?? 'The daemon returned an invalid response.'}
              systemImage="exclamationmark.triangle"
              title="Could not read terminals"
            />
            <Button
              label="Retry"
              onPress={(): void => {
                roster.refetch()
              }}
              systemImage="arrow.clockwise"
            />
          </Section>
        ) : null}
        <Section title="Sessions">
          {roster.isPending && roster.sessions.length === 0 ? (
            <ContentUnavailableView
              description="Reading daemon-owned PTYs."
              systemImage="terminal"
              title="Loading"
            />
          ) : roster.sessions.length === 0 ? (
            <>
              <ContentUnavailableView
                description={
                  showAll
                    ? 'The daemon has no live or recent PTYs.'
                    : 'Try another repo or show all sessions.'
                }
                systemImage="terminal"
                title="No shells running"
              />
              <Button
                label="Start a shell"
                onPress={(): void => router.push('/new')}
                systemImage="plus"
              />
              <Button
                label={showAll ? 'Showing all sessions' : 'Show all sessions'}
                onPress={(): void => {
                  onToggleShowAll((current) => !current)
                }}
                systemImage="list.bullet"
              />
            </>
          ) : (
            roster.sessions.map((current) => (
              <TerminalSessionRow
                key={current.id}
                onKill={(): void => kill(current.id, current.name)}
                onOpen={(): void =>
                  router.push({ params: { id: current.id }, pathname: '/session/[id]' })
                }
                onRename={(): void => rename(current.id, current.name)}
                repoPath={repo?.path ?? null}
                scheme={scheme}
                session={current}
              />
            ))
          )}
        </Section>
        <TerminalActionsSection
          actions={actions.actions}
          onRun={(action: TerminalAction): void => {
            runAction(action)
          }}
          runningId={runningAction}
        />
      </List>
    </ScreenHost>
  )
}
