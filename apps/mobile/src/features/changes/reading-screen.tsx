import { Button, List, Section, Text } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { HeaderToolbar } from '@/components/header-toolbar'
import { ScreenHost } from '@/components/screen-host'
import { DiffSurface } from '@/features/changes/components/diff-surface'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { useDiffReading, useReviewedPaths, useScopeFlow } from '@/features/changes/data/queries'
import {
  CANVAS_FILE_LINES,
  type DiffRow,
  isLargeChange,
  readingRows,
  totalStats,
} from '@/features/changes/lib/diff-rows'
import { formatStats } from '@/features/changes/lib/format'
import { parseScope, scopeParams } from '@/features/changes/lib/scope'
import { useDiffTokenizer } from '@/features/changes/lib/use-diff-tokenizer'
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
      <HeaderToolbar companion={{ href: '/actions', icon: 'bolt', label: 'Actions' }} />
    </>
  )
}

function Reading({ scope }: { scope: DiffReadingScope }): React.JSX.Element {
  const [confirmed, setConfirmed] = useState(false)
  const tokenizer = useDiffTokenizer(useColorScheme())
  const flow = useScopeFlow(scope)
  const reviewed = useReviewedPaths(scope.type === 'working')
  const totals = totalStats(flow.data ?? [])
  const large = flow.data !== undefined && isLargeChange(totals)
  const reading = useDiffReading(scope, flow.data !== undefined && (!large || confirmed))
  // Built once per response: every re-render otherwise re-runs the word diff over the whole
  // change and re-serializes it, on the JS thread, for a document the native side already has.
  const rows = useMemo(
    (): DiffRow[] =>
      reading.data === undefined ? [] : readingRows(reading.data, CANVAS_FILE_LINES),
    [reading.data],
  )

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
    <DiffSurface
      collapsible
      contentKey={`reading:${scope.type}:${scope.type === 'commit' ? scope.hash : 'working'}`}
      onOpenFile={openFile}
      rows={rows}
      reviewedPaths={scope.type === 'working' ? reviewed.data : undefined}
      tokenizer={tokenizer}
    />
  )
}
