import {
  Button,
  ContentUnavailableView,
  HStack,
  List,
  Section,
  Spacer,
  SwipeActions,
  Text,
  VStack,
} from '@expo/ui/swift-ui'
import { foregroundStyle, listStyle } from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'
import { useState } from 'react'

import { ScreenHost } from '@/components/screen-host'
import { SheetCloseToolbar } from '@/components/sheet-close-toolbar'
import { DaemonError, daemonErrorMessage } from '@/lib/daemon/errors'
import { recentReposQuery, removeRecentRepoMutation } from '@/lib/daemon/procedures/connection'
import { useDaemonInvalidate, useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { openRepo } from '@/lib/daemon/repo'
import { footnote, secondary } from '@/theme/modifiers'

/**
 * The daemon's recent repos. Every path here is a daemon path — the phone never reads its own
 * filesystem for repo content, so there is no local file picker to fall back to.
 */
export function RepoPickerScreen(): React.JSX.Element {
  const recents = useDaemonQuery(recentReposQuery, { includeWorktrees: true })
  const forget = useDaemonMutation(removeRecentRepoMutation, { invalidates: ['recentRepos'] })
  const invalidate = useDaemonInvalidate()
  const [error, setError] = useState<string | null>(null)

  async function choose(path: string): Promise<void> {
    try {
      await openRepo(path)
    } catch (cause) {
      setError(
        cause instanceof DaemonError
          ? daemonErrorMessage(cause)
          : cause instanceof Error
            ? cause.message
            : 'That repo could not be opened.',
      )
      return
    }
    // Opening a repo records it daemon-side, which reorders this very list.
    invalidate(['recentRepos'])
    router.back()
  }

  return (
    <>
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section title="Recent">
            {recents.data === undefined || recents.data.length === 0 ? (
              <ContentUnavailableView
                description={
                  (recents.error === null || recents.error === undefined
                    ? null
                    : daemonErrorMessage(recents.error)) ??
                  'Open a repo on the host once and it shows up here. Or browse the daemon below.'
                }
                systemImage="folder"
                title={recents.isPending ? 'Loading repos' : 'No recent repos'}
              />
            ) : (
              recents.data.map((repo) => (
                <SwipeActions key={repo.path}>
                  <Button
                    onPress={(): void => {
                      choose(repo.path)
                    }}
                  >
                    <HStack>
                      <VStack alignment="leading" spacing={2}>
                        <Text>{repo.name}</Text>
                        <Text modifiers={[footnote, secondary]}>{repo.path}</Text>
                      </VStack>
                      <Spacer />
                    </HStack>
                  </Button>
                  <SwipeActions.Actions>
                    <Button
                      label="Remove"
                      onPress={(): void => {
                        forget.mutate(repo.path)
                      }}
                      role="destructive"
                      systemImage="trash"
                    />
                  </SwipeActions.Actions>
                </SwipeActions>
              ))
            )}
          </Section>
          <Section
            footer={
              error === null ? undefined : (
                <Text modifiers={[footnote, foregroundStyle({ color: '#FF3B30', type: 'color' })]}>
                  {error}
                </Text>
              )
            }
          >
            <Button
              label="Browse the daemon…"
              onPress={(): void => router.push('/repo/browse')}
              systemImage="externaldrive.connected.to.line.below"
            />
          </Section>
        </List>
      </ScreenHost>
      <SheetCloseToolbar />
    </>
  )
}
