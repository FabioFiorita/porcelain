import { HStack, List, Section, Spacer, Text } from '@expo/ui/swift-ui'
import { font, listStyle, refreshable } from '@expo/ui/swift-ui/modifiers'
import { headLabel } from '@porcelain/contracts'
import { ObserveInteractiveMarker } from 'expo-observe'
import { router } from 'expo-router'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import { FlowGroupList } from '@/features/changes/components/flow-group-list'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { useHead, useReviewedPaths, useWorkingFlow } from '@/features/changes/data/queries'
import { totalStats } from '@/features/changes/lib/diff-rows'
import { formatStats } from '@/features/changes/lib/format'
import { footnote, secondary } from '@/theme/modifiers'

const headline = font({ textStyle: 'headline' })

/**
 * The tab's home: the working tree, grouped by review-flow layer in the daemon's order. A row
 * opens that file's diff; the whole change is read from the Read button, the one place the
 * heavy `diffReading` is ever fired.
 */
export function ChangesScreen(): React.JSX.Element {
  return (
    <>
      <DaemonGate requires="repo">
        <WorkingTree />
      </DaemonGate>
      <ScreenHeader
        actions={[
          { href: '/reading', icon: 'read', label: 'Read' },
          { href: '/history', icon: 'history', label: 'History' },
        ]}
        companion={{ href: '/actions', icon: 'bolt', label: 'Actions' }}
        title="Changes"
      />
      <ObserveInteractiveMarker />
    </>
  )
}

function WorkingTree(): React.JSX.Element {
  const flow = useWorkingFlow()
  const reviewed = useReviewedPaths()
  const head = useHead()

  const groups = flow.data ?? []
  const totals = totalStats(groups)

  async function refresh(): Promise<void> {
    await Promise.all([flow.refetch(), reviewed.refetch(), head.refetch()])
  }

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped'), refreshable(refresh)]}>
        <Section>
          <HStack spacing={8}>
            <Text modifiers={[headline]}>
              {head.data === undefined ? 'Working tree' : headLabel(head.data)}
            </Text>
            <Spacer />
            <Text modifiers={[footnote, secondary]}>
              {summaryDetail(totals, reviewed.data?.length ?? 0)}
            </Text>
          </HStack>
        </Section>
        {groups.length === 0 ? (
          <Section>
            <QueryNotice
              description="Nothing is waiting for review in this checkout."
              error={flow.error}
              isPending={flow.isPending}
              onRetry={(): void => {
                flow.refetch()
              }}
              symbol="checkmark.seal"
              title="Working tree clean"
            />
          </Section>
        ) : (
          <FlowGroupList
            groups={groups}
            onSelect={(path: string): void => {
              router.push({ params: { path, scope: 'working' }, pathname: '/file' })
            }}
            reviewedPaths={reviewed.data}
          />
        )}
      </List>
    </ScreenHost>
  )
}

function summaryDetail(
  totals: { files: number; additions: number; deletions: number },
  reviewed: number,
): string {
  return [
    `${totals.files} file${totals.files === 1 ? '' : 's'}`,
    formatStats(totals.additions, totals.deletions),
    reviewed === 0 ? '' : `${reviewed} reviewed`,
  ]
    .filter((part) => part !== '')
    .join(' · ')
}
