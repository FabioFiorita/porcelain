import { List, Section } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { headLabel } from '@porcelain/contracts'
import { ObserveInteractiveMarker } from 'expo-observe'
import { router } from 'expo-router'
import { useEffect, useMemo } from 'react'
import { Platform, useColorScheme } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { EntryCanvas } from '@/components/entry-canvas'
import type { EntryItem, EntrySpan, EntryTarget } from '@/components/entry-rows'
import { IPadDetailPlaceholder } from '@/components/ipad-detail-placeholder'
import { ListLinkRow } from '@/components/list-link-row'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { QueryNotice } from '@/features/changes/components/query-notice'
import {
  useFeatureViewSummary,
  useHead,
  useReviewedPaths,
  useWorkingFlow,
} from '@/features/changes/data/queries'
import { totalStats } from '@/features/changes/lib/diff-rows'
import { flowEntryItems } from '@/features/changes/lib/flow-rows'
import { formatStats } from '@/features/changes/lib/format'
import { useIPadDestination } from '@/lib/ipad-destination'
import { accentColor } from '@/theme/colors'

export const ALL_CHANGES_KEY = 'item:all-changes'
const REVIEW_KEY = 'item:review'

function isIPad(): boolean {
  return 'isPad' in Platform && Platform.isPad
}

/**
 * The tab's home: the working tree, grouped by review-flow layer in the daemon's order. A row
 * opens that file's diff; All changes opens the whole change as one document, the one place the
 * heavy `diffReading` is ever fired.
 *
 * On iPad the list lives in the SplitView supplementary column; this Slot shows an empty
 * state until a file is opened.
 */
export function ChangesScreen(): React.JSX.Element {
  useSurfaceFocus('changes')
  useEffect(() => {
    if (isIPad()) useIPadDestination.getState().setDestination('changes')
  }, [])

  return (
    <>
      {isIPad() ? (
        <IPadDetailPlaceholder
          description="Choose a changed file from the list to open its diff."
          title="Select a file"
        />
      ) : (
        <ChangesSplitColumn />
      )}
      {/* History is the tab face alternate — re-tap the tab bar; no header switcher. */}
      <ScreenHeader title="Changes" />
      <ObserveInteractiveMarker />
    </>
  )
}

/** List-only column for iPad SplitView supplementary (detail opens in the secondary Slot). */
export function ChangesSplitColumn(): React.JSX.Element {
  return (
    <DaemonGate requires="repo">
      <WorkingTree />
    </DaemonGate>
  )
}

function WorkingTree(): React.JSX.Element {
  const flow = useWorkingFlow()
  const reviewed = useReviewedPaths()
  const head = useHead()
  const featureView = useFeatureViewSummary()
  const accent = accentColor(useColorScheme() === 'dark' ? 'dark' : 'light')

  const groups = flow.data ?? []
  const totals = totalStats(groups)
  const reviewedPaths = reviewed.data
  const reviewName = featureView.data?.name
  const headData = head.data

  const items = useMemo((): EntryItem[] => {
    const rows: EntryItem[] = [
      {
        key: 'section:head',
        kind: 'section',
        title: headData === undefined ? 'Working tree' : headLabel(headData),
        trailing: summarySpans(totals, reviewedPaths?.length ?? 0),
      },
    ]
    if (groups.length > 0) {
      rows.push({
        key: ALL_CHANGES_KEY,
        kind: 'item',
        name: 'All changes',
        symbol: { name: 'text.alignleft', tint: accent },
        trailing: [{ text: 'every changed file in flow order' }],
      })
    }
    if (reviewName !== undefined) {
      rows.push({
        key: REVIEW_KEY,
        kind: 'item',
        name: 'Review agent work',
        symbol: { name: 'checkmark.seal', tint: accent },
        trailing: [{ text: reviewName }],
      })
    }
    rows.push(...flowEntryItems(groups, reviewedPaths))
    return rows
  }, [accent, groups, headData, reviewName, reviewedPaths, totals])

  function refresh(): void {
    Promise.all([flow.refetch(), reviewed.refetch(), head.refetch()]).catch(() => {
      // The last listing stays on screen; a cold list falls through to the notice below.
    })
  }

  if (groups.length === 0) {
    return (
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          {/* A clean tree is the common state right after the agent commits — and exactly when
              the published Review still wants reading. Losing this row loses the route to it. */}
          {reviewName === undefined ? null : (
            <Section title="Review">
              <ListLinkRow
                detail={reviewName}
                icon="checkmark.seal"
                label="Review agent work"
                onPress={(): void => router.push('/review')}
              />
            </Section>
          )}
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
        </List>
      </ScreenHost>
    )
  }

  return (
    <EntryCanvas
      contentKey="changes:working"
      items={items}
      onPress={(item: EntryTarget): void => {
        if (item.key === ALL_CHANGES_KEY) {
          router.push('/reading')
          return
        }
        if (item.key === REVIEW_KEY) {
          router.push('/review')
          return
        }
        if (item.kind === 'item') return
        router.push({ params: { path: item.path, scope: 'working' }, pathname: '/file' })
      }}
      onRefresh={refresh}
      refreshing={flow.isFetching}
    />
  )
}

function summarySpans(
  totals: { files: number; additions: number; deletions: number },
  reviewed: number,
): EntrySpan[] {
  return [
    { text: `${totals.files} file${totals.files === 1 ? '' : 's'}` },
    { text: formatStats(totals.additions, totals.deletions) },
    { text: reviewed === 0 ? '' : `${reviewed} reviewed` },
  ].filter((span) => span.text !== '')
}
