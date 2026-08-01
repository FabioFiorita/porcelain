import { Button, List, Section, Text } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { DaemonGate } from '@/components/daemon-gate'
import { HeaderToolbar } from '@/components/header-toolbar'
import { ScreenHost } from '@/components/screen-host'
import { DiffRowsView } from '@/features/changes/components/diff-rows-view'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { useDiffReading, useScopeFlow } from '@/features/changes/data/queries'
import { isLargeChange, readingRows, totalStats } from '@/features/changes/lib/diff-rows'
import { formatStats } from '@/features/changes/lib/format'
import { parseScope, scopeParams } from '@/features/changes/lib/scope'
import type { DiffReadingScope } from '@/lib/daemon/procedures/changes'
import { footnote, secondary } from '@/theme/modifiers'

/**
 * The whole change as one scrolling document, in flow order. Reached only by an explicit tap:
 * `diffReading` can carry ~200 files of hunks in one response, so it is never prefetched and
 * never polled, and a change the flow totals say is large asks first.
 */
export function ReadingScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ scope?: string; hash?: string }>()
  const scope = parseScope(params.scope, params.hash)

  return (
    <>
      <DaemonGate requires="repo">
        <Reading scope={scope} />
      </DaemonGate>
      <HeaderToolbar />
    </>
  )
}

function Reading({ scope }: { scope: DiffReadingScope }): React.JSX.Element {
  const [confirmed, setConfirmed] = useState(false)
  const flow = useScopeFlow(scope)
  const totals = totalStats(flow.data ?? [])
  const large = flow.data !== undefined && isLargeChange(totals)
  const reading = useDiffReading(scope, flow.data !== undefined && (!large || confirmed))

  function openFile(path: string): void {
    router.push({ params: { ...scopeParams(scope), path }, pathname: '/file' })
  }

  if (large && !confirmed) {
    return (
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section title="Large change">
            <Text>{`${totals.files} files · ${formatStats(totals.additions, totals.deletions)}`}</Text>
            <Text modifiers={[footnote, secondary]}>
              Reading this inline pulls every file's diff in one response. Opening files one at a
              time is faster on a phone.
            </Text>
            <Button label="Read file by file" onPress={(): void => router.back()} />
            <Button label="Load anyway" onPress={(): void => setConfirmed(true)} />
          </Section>
        </List>
      </ScreenHost>
    )
  }

  if (reading.data === undefined) {
    return (
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section>
            <QueryNotice
              description="Reading the whole change from the daemon."
              error={reading.error ?? flow.error}
              isPending={reading.isPending}
              onRetry={(): void => {
                reading.refetch()
              }}
              symbol="text.alignleft"
              title="Nothing to read"
            />
          </Section>
        </List>
      </ScreenHost>
    )
  }

  return (
    <ScreenHost>
      <DiffRowsView onOpenFile={openFile} rows={readingRows(reading.data)} />
    </ScreenHost>
  )
}
