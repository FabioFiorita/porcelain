import { HStack, List, Section, Spacer, Text } from '@expo/ui/swift-ui'
import { font, listStyle, refreshable } from '@expo/ui/swift-ui/modifiers'
import { headLabel } from '@porcelain/contracts'
import { ObserveInteractiveMarker } from 'expo-observe'
import { router } from 'expo-router'

import { DaemonGate } from '@/components/daemon-gate'
import { ListLinkRow } from '@/components/list-link-row'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { useTabRootFocusRegistration } from '@/components/use-tab-root-focus'
import { FlowGroupList } from '@/features/changes/components/flow-group-list'
import { QueryNotice } from '@/features/changes/components/query-notice'
import {
  useFeatureViewSummary,
  useHead,
  useReviewedPaths,
  useWorkingFlow,
} from '@/features/changes/data/queries'
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
  useSurfaceFocus('changes')
  useTabRootFocusRegistration('changes')

  return (
    <>
      <DaemonGate requires="repo">
        <WorkingTree />
      </DaemonGate>
      <ScreenHeader
        actions={[{ href: '/history', icon: 'history', label: 'History' }]}
        companion={{ href: '/companion', icon: 'companion', label: 'Companion' }}
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
  const featureView = useFeatureViewSummary()

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
        {groups.length === 0 &&
        (featureView.data === null || featureView.data === undefined) ? null : (
          <Section title="Review">
            {groups.length === 0 ? null : (
              <ListLinkRow
                detail="Read every changed file in flow order"
                icon="text.alignleft"
                label="Read changes"
                onPress={(): void => router.push('/reading')}
              />
            )}
            {featureView.data === null || featureView.data === undefined ? null : (
              <ListLinkRow
                detail={featureView.data.name}
                icon="checkmark.seal"
                label="Review agent work"
                onPress={(): void => router.push('/review')}
              />
            )}
          </Section>
        )}
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
