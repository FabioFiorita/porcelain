import { Button, List, Section, Text } from '@expo/ui/swift-ui'
import { listStyle, refreshable } from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'
import { useState } from 'react'

import { DaemonGate } from '@/components/daemon-gate'
import { ListLinkRow } from '@/components/list-link-row'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { useLog } from '@/features/changes/data/queries'
import { shortHash } from '@/features/changes/lib/format'
import { monospace, secondary } from '@/theme/modifiers'

/** There is no cursor API — "more" is the same query with a bigger limit, capped daemon-side. */
const PAGE = 100
const MAX_LIMIT = 500

/** Commit history as the Changes tab face — same chrome as Changes, no back chevron. */
export function HistoryScreen(): React.JSX.Element {
  useSurfaceFocus('history')

  return (
    <>
      <DaemonGate requires="repo">
        <Log />
      </DaemonGate>
      <ScreenHeader title="History" />
    </>
  )
}

function Log(): React.JSX.Element {
  const [limit, setLimit] = useState(PAGE)
  const log = useLog(limit)
  const commits = log.data ?? []

  async function refresh(): Promise<void> {
    await log.refetch()
  }

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped'), refreshable(refresh)]}>
        <Section>
          {commits.length === 0 ? (
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
          ) : (
            commits.map((commit) => (
              <ListLinkRow
                detail={`${commit.author} · ${commit.date}`}
                key={commit.hash}
                label={commit.subject}
                onPress={(): void => {
                  router.push({
                    params: {
                      author: commit.author,
                      date: commit.date,
                      hash: commit.hash,
                    },
                    pathname: '/commit/[hash]',
                  })
                }}
                trailing={<TextHash hash={commit.hash} />}
              />
            ))
          )}
          {commits.length < limit || limit >= MAX_LIMIT ? null : (
            <Button
              label={`Load ${PAGE} more`}
              onPress={(): void => setLimit(Math.min(limit + PAGE, MAX_LIMIT))}
            />
          )}
        </Section>
      </List>
    </ScreenHost>
  )
}

function TextHash({ hash }: { hash: string }): React.JSX.Element {
  return <Text modifiers={[monospace, secondary]}>{shortHash(hash)}</Text>
}
