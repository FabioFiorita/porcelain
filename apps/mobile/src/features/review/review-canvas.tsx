import { Text, View } from 'react-native'

import { ErrorNote } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/segmented-control'
import { useReviewedPaths } from '@/features/changes/use-changes'
import { cn } from '@/lib/utils'

import { EvidenceBody } from './evidence-body'
import { ExecutionBody } from './execution-body'
import { IntentBody } from './intent-body'
import { SourceCounts } from './review-chrome'
import { ReviewEmptyState } from './review-empty'
import { reviewedFractionOf, reviewSourceCounts } from './review-lifecycle'
import { type ReviewCanvasTab, useReviewStore } from './review-store'
import { useFeatureReading } from './use-review'

const CANVAS_TABS: readonly { value: ReviewCanvasTab; label: string; testID: string }[] = [
  { label: 'Intent', testID: 'porcelain-review-tab-intent', value: 'intent' },
  { label: 'Execution', testID: 'porcelain-review-tab-execution', value: 'execution' },
  { label: 'Evidence', testID: 'porcelain-review-tab-evidence', value: 'evidence' },
]

/**
 * The Review canvas: the unit's name and source legend, and the three tabs that answer its
 * three questions — why (Intent), what (Execution), proof (Evidence).
 *
 * One component for both hosts, the way the companions are: the tablet gives it the viewer
 * column beside the outline, the phone gives it the whole tab body under its header. Two
 * canvases for one surface is how the two form factors start disagreeing about what a Review
 * says.
 *
 * Only the visible tab's body is mounted, which is also what makes the lazy reads lazy — a
 * hidden Intent or Evidence pane has no query in flight at all.
 */
export function ReviewCanvas({ active }: { active: boolean }): React.JSX.Element {
  const { error, isLoading, reading } = useFeatureReading(active)
  const tab = useReviewStore((state) => state.canvasTab)
  const setTab = useReviewStore((state) => state.setCanvasTab)
  // Shares the Changes tab's cache entry, so this costs nothing extra — but only ask once a
  // review exists to measure against.
  const reviewed = useReviewedPaths(active && reading !== null && reading !== undefined)

  if (error !== null) {
    return (
      <View className="flex-1 bg-background p-4" testID="porcelain-review-canvas">
        <ErrorNote message={error.message} testID="porcelain-review-error" />
      </View>
    )
  }

  if (reading === undefined) {
    return (
      <View className="flex-1 bg-background" testID="porcelain-review-canvas">
        <Text
          className="p-4 text-sm text-muted-foreground"
          testID={isLoading ? 'porcelain-review-loading' : 'porcelain-review-idle'}
        >
          {isLoading ? 'Loading the Review…' : 'No daemon connected.'}
        </Text>
      </View>
    )
  }

  if (reading === null) {
    return (
      <View className="flex-1 bg-background" testID="porcelain-review-canvas">
        <ReviewEmptyState />
      </View>
    )
  }

  const counts = reviewSourceCounts(reading)
  const { reviewedCount, total } = reviewedFractionOf(reading, reviewed)

  return (
    <View className="flex-1 bg-background" testID="porcelain-review-canvas">
      <View className="gap-1.5 border-b border-border px-4 pb-3 pt-3">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {reading.name}
        </Text>
        <View className="flex-row items-center justify-between gap-2">
          <SourceCounts counts={counts} testID="porcelain-review-source-counts" />
          {total === 0 ? null : (
            <Text
              className={cn(
                'text-[10px]',
                reviewedCount === total ? 'text-success' : 'text-muted-foreground',
              )}
              testID="porcelain-review-reviewed-fraction"
            >
              {reviewedCount}/{total} reviewed
            </Text>
          )}
        </View>
      </View>

      <View className="px-4 py-2">
        <SegmentedControl<ReviewCanvasTab>
          options={CANVAS_TABS}
          testID="porcelain-review-tabs"
          value={tab}
          onChange={setTab}
        />
      </View>

      {/* Evidence stays selectable with nothing published: a phone has no tooltip to explain
          a disabled segment, so the tab tells you what is missing instead of refusing the tap. */}
      {tab === 'intent' ? (
        <IntentBody active={active} reading={reading} />
      ) : tab === 'execution' ? (
        <ExecutionBody active={active} reading={reading} />
      ) : (
        <EvidenceBody active={active} meta={reading.evidence} />
      )}
    </View>
  )
}
