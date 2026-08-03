import { List, Section } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Platform, useColorScheme } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { EntryCanvas } from '@/components/entry-canvas'
import type { EntryItem, EntryTarget } from '@/components/entry-rows'
import { IPadDetailPlaceholder } from '@/components/ipad-detail-placeholder'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { useLog } from '@/features/changes/data/queries'
import { shortHash } from '@/features/changes/lib/format'
import { useIPadDestination } from '@/lib/ipad-destination'
import { accentColor, ink } from '@/theme/colors'

/** There is no cursor API — "more" is the same query with a bigger limit, capped daemon-side. */
const PAGE = 100
const MAX_LIMIT = 500
const MORE_KEY = 'item:more'

function isIPad(): boolean {
  return 'isPad' in Platform && Platform.isPad
}

/**
 * Commit history as the Changes tab face — same chrome as Changes, no back chevron.
 * On iPad the log lives in the supplementary column; this Slot is empty until a commit opens.
 */
export function HistoryScreen(): React.JSX.Element {
  useSurfaceFocus('history')
  useEffect(() => {
    if (isIPad()) useIPadDestination.getState().setDestination('history')
  }, [])

  return (
    <>
      {isIPad() ? (
        <IPadDetailPlaceholder
          description="Choose a commit from the list to open it."
          title="Select a commit"
        />
      ) : (
        <HistorySplitColumn />
      )}
      <ScreenHeader title="History" />
    </>
  )
}

/** List-only column for iPad SplitView supplementary. */
export function HistorySplitColumn(): React.JSX.Element {
  return (
    <DaemonGate requires="repo">
      <Log />
    </DaemonGate>
  )
}

function Log(): React.JSX.Element {
  const [limit, setLimit] = useState(PAGE)
  const log = useLog(limit)
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const commits = log.data ?? []

  const items = useMemo((): EntryItem[] => {
    const dot = ink('muted', scheme)
    const rows: EntryItem[] = commits.map(
      (commit): EntryItem => ({
        key: commit.hash,
        kind: 'item',
        label: `${commit.subject}, ${commit.author}, ${commit.date}`,
        name: commit.subject,
        symbol: { name: 'circle.fill', tint: dot },
        trailing: [
          { text: shortHash(commit.hash) },
          { text: commit.author },
          { text: commit.date },
        ],
      }),
    )
    if (commits.length >= limit && limit < MAX_LIMIT) {
      rows.push({
        key: MORE_KEY,
        kind: 'item',
        name: `Load ${PAGE} more`,
        symbol: { name: 'ellipsis.circle', tint: accentColor(scheme) },
      })
    }
    return rows
  }, [commits, limit, scheme])

  function refresh(): void {
    log.refetch().catch(() => {
      // The log on screen stays; a cold log falls through to the notice below.
    })
  }

  if (commits.length === 0) {
    return (
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section>
            <QueryNotice
              description="This checkout has no commits yet."
              error={log.error}
              isPending={log.isPending}
              onRetry={(): void => {
                log.refetch()
              }}
              symbol="clock.arrow.circlepath"
              title="No commits yet"
            />
          </Section>
        </List>
      </ScreenHost>
    )
  }

  return (
    <EntryCanvas
      contentKey="history:log"
      items={items}
      onPress={(item: EntryTarget): void => {
        if (item.key === MORE_KEY) {
          setLimit(Math.min(limit + PAGE, MAX_LIMIT))
          return
        }
        const commit = commits.find((entry) => entry.hash === item.key)
        if (commit === undefined) return
        router.push({
          params: { author: commit.author, date: commit.date, hash: commit.hash },
          pathname: '/commit/[hash]',
        })
      }}
      onRefresh={refresh}
      refreshing={log.isFetching}
    />
  )
}
