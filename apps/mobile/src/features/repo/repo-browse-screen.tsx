import { Button, ContentUnavailableView, List, Section, Text } from '@expo/ui/swift-ui'
import { foregroundStyle, listStyle } from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'
import { useState } from 'react'

import { ListLinkRow } from '@/components/list-link-row'
import { ScreenHost } from '@/components/screen-host'
import { DaemonError, daemonErrorMessage } from '@/lib/daemon/errors'
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
      setError(
        cause instanceof DaemonError
          ? daemonErrorMessage(cause)
          : cause instanceof Error
            ? cause.message
            : 'That repo could not be opened.',
      )
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
              description={
                listing.error === null || listing.error === undefined
                  ? 'Reading the daemon’s directories.'
                  : daemonErrorMessage(listing.error)
              }
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
            <ListLinkRow
              icon={entry.isRepo ? 'shippingbox' : 'folder'}
              key={entry.path}
              label={entry.name}
              onPress={(): void => {
                if (entry.isRepo) {
                  choose(entry.path)
                } else {
                  setPath(entry.path)
                }
              }}
            />
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
