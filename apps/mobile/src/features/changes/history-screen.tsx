import { Button, HStack, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  buttonStyle,
  contentShape,
  frame,
  lineLimit,
  listStyle,
  refreshable,
  shapes,
} from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'
import { useState } from 'react'

import { DaemonGate } from '@/components/daemon-gate'
import { HeaderToolbar } from '@/components/header-toolbar'
import { ScreenHost } from '@/components/screen-host'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { useLog } from '@/features/changes/data/queries'
import { shortHash } from '@/features/changes/lib/format'
import { footnote, monospace, secondary } from '@/theme/modifiers'

/** There is no cursor API — "more" is the same query with a bigger limit, capped daemon-side. */
const PAGE = 100
const MAX_LIMIT = 500

/** Commit history, pushed from the Changes header rather than owning a tab of its own. */
export function HistoryScreen(): React.JSX.Element {
  return (
    <>
      <DaemonGate requires="repo">
        <Log />
      </DaemonGate>
      {/*
        Toolbar only, no `ScreenHeader`: a custom left header item would take the slot the
        back button needs, and a pushed screen has to keep its way back.
      */}
      <HeaderToolbar companion={{ href: '/actions', icon: 'bolt', label: 'Actions' }} />
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
              <Button
                key={commit.hash}
                modifiers={[
                  buttonStyle('plain'),
                  frame({ maxWidth: Infinity, alignment: 'leading' }),
                  contentShape(shapes.rectangle()),
                ]}
                onPress={(): void => {
                  router.push({ params: { hash: commit.hash }, pathname: '/commit/[hash]' })
                }}
              >
                <HStack
                  modifiers={[
                    frame({ maxWidth: Infinity, alignment: 'leading' }),
                    contentShape(shapes.rectangle()),
                  ]}
                  spacing={10}
                >
                  <VStack alignment="leading" spacing={2}>
                    <Text modifiers={[lineLimit(1)]}>{commit.subject}</Text>
                    <Text modifiers={[footnote, secondary, lineLimit(1)]}>
                      {`${commit.author} · ${commit.date}`}
                    </Text>
                  </VStack>
                  <Spacer />
                  <Text modifiers={[monospace, secondary]}>{shortHash(commit.hash)}</Text>
                </HStack>
              </Button>
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
