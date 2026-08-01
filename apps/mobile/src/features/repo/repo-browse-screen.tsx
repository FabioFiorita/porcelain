import {
  Button,
  ContentUnavailableView,
  HStack,
  List,
  Section,
  Spacer,
  Text,
} from '@expo/ui/swift-ui'
import { foregroundStyle, listStyle } from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'
import { useState } from 'react'

import { ScreenHost } from '@/components/screen-host'
import { browseDirsQuery } from '@/lib/daemon/procedures/connection'
import { useDaemonInvalidate, useDaemonQuery } from '@/lib/daemon/queries'
import { openRepo } from '@/lib/daemon/repo'
import { footnote, secondary } from '@/theme/modifiers'

/** iOS systemRed. */
const errorStyle = foregroundStyle({ color: '#FF3B30', type: 'color' })

/** `List` renders every row on the JS thread, so a directory like `/nix/store` gets a cap. */
const MAX_ROWS = 200

/** Walks the daemon's directories. `null` starts at the daemon's home. */
export function RepoBrowseScreen(): React.JSX.Element {
  const [path, setPath] = useState<string | null>(null)
  const listing = useDaemonQuery(browseDirsQuery, path)
  const invalidate = useDaemonInvalidate()
  const [error, setError] = useState<string | null>(null)

  async function choose(repoPath: string): Promise<void> {
    try {
      await openRepo(repoPath)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That repo could not be opened.')
      return
    }
    invalidate(['recentRepos'])
    router.dismissAll()
  }

  const data = listing.data
  const shown = data === undefined ? [] : data.entries.slice(0, MAX_ROWS)
  const hidden = data === undefined ? 0 : data.entries.length - shown.length
  const parent = data?.parent ?? null

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section title={data?.path ?? 'Daemon'}>
          {data === undefined ? (
            <ContentUnavailableView
              description={listing.error?.message ?? 'Reading the daemon’s directories.'}
              systemImage="externaldrive"
              title={listing.isPending ? 'Loading' : 'Nothing to browse'}
            />
          ) : null}
          {parent === null ? null : (
            <Button
              label="Up one level"
              onPress={(): void => setPath(parent)}
              systemImage="arrow.up.left"
            />
          )}
          {shown.map((entry) => (
            <HStack key={entry.path}>
              <Button
                onPress={(): void => setPath(entry.path)}
                systemImage={entry.isRepo ? 'shippingbox' : 'folder'}
              >
                <Text>{entry.name}</Text>
              </Button>
              <Spacer />
              {entry.isRepo ? (
                <Button
                  label="Open"
                  onPress={(): void => {
                    choose(entry.path)
                  }}
                />
              ) : null}
            </HStack>
          ))}
          {error === null ? null : <Text modifiers={[footnote, errorStyle]}>{error}</Text>}
          {hidden === 0 ? null : (
            <Text modifiers={[footnote, secondary]}>{`…and ${hidden} more`}</Text>
          )}
        </Section>
      </List>
    </ScreenHost>
  )
}
