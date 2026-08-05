import { useState } from 'react'
import { Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ErrorNote, StatusNote } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/segmented-control'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { useReviewedPaths } from '@/features/changes/use-changes'
import { copyText } from '@/lib/clipboard'
import type { FeatureReading } from '@/lib/daemon/procedures/review'
import { cn } from '@/lib/utils'

import { EvidenceBody } from './evidence-body'
import { ExecutionBody } from './execution-body'
import { IntentBody } from './intent-body'
import { SourceCounts } from './review-chrome'
import { ReviewEmptyState } from './review-empty'
import {
  lifecycleBadgeLabel,
  lifecycleDetail,
  reviewContinuePrompt,
  reviewEndPrompt,
  reviewedFractionOf,
  reviewLifecyclePhase,
  reviewSourceCounts,
} from './review-lifecycle'
import { type ReviewCanvasTab, useReviewStore } from './review-store'
import { useFeatureReading } from './use-review'

const CANVAS_TABS: readonly { value: ReviewCanvasTab; label: string; testID: string }[] = [
  { label: 'Intent', testID: 'porcelain-review-tab-intent', value: 'intent' },
  { label: 'Execution', testID: 'porcelain-review-tab-execution', value: 'execution' },
  { label: 'Evidence', testID: 'porcelain-review-tab-evidence', value: 'evidence' },
]

/**
 * The Review canvas: the unit's name and source legend, where it is in its lifecycle, and the
 * three tabs that answer its three questions — why (Intent), what (Execution), proof
 * (Evidence).
 *
 * One component for both hosts, the way the companions are: the tablet gives it the viewer
 * column beside the outline, the phone gives it the whole tab body under its header. Two
 * canvases for one surface is how the two form factors start disagreeing about what a Review
 * says.
 *
 * Only the visible tab's body is mounted, which is also what makes the lazy reads lazy — a
 * hidden Intent or Evidence pane has no query in flight at all.
 */
export function ReviewCanvas({
  active,
  bottomInset = 0,
}: {
  active: boolean
  /** Phone: room for the floating tab bar the canvas scrolls under. */
  bottomInset?: number
}): React.JSX.Element {
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
  const { fraction, reviewedCount, total } = reviewedFractionOf(reading, reviewed)

  return (
    <View className="flex-1 bg-background" testID="porcelain-review-canvas">
      <View className="gap-1.5 border-b border-border px-3 pb-2 pt-1.5">
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

      <LifecycleBanner reading={reading} reviewedFraction={fraction} />

      <View className="px-3 py-2">
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
        <ExecutionBody active={active} bottomInset={bottomInset} reading={reading} />
      ) : (
        <EvidenceBody active={active} meta={reading.evidence} />
      )}
    </View>
  )
}

/**
 * Where the unit is, and the prompt that moves it on.
 *
 * The prompt is the actionable half: mid-session it asks the agent to keep growing Execution,
 * and once the unit reads as ready it asks for the close — full Execution, real Evidence.
 * Copying it is the one thing a phone can do that actually advances the work.
 */
function LifecycleBanner({
  reading,
  reviewedFraction,
}: {
  reading: FeatureReading
  reviewedFraction: number
}): React.JSX.Element {
  const [status, setStatus] = useState<{ failed: boolean; text: string } | null>(null)
  const phase = reviewLifecyclePhase({ reading, reviewedFraction })
  // The caller only mounts this with a reading in hand; treat empty as in progress.
  const effective = phase === 'empty' ? 'in_progress' : phase
  const badge = lifecycleBadgeLabel(effective)
  const ready = effective === 'ready_to_close'

  const handleCopy = (): void => {
    const prompt = ready ? reviewEndPrompt(reading.name) : reviewContinuePrompt(reading.name)
    copyText(prompt)
      .then((copied) => {
        setStatus({
          failed: !copied,
          text: copied
            ? `${ready ? 'End' : 'Continue'} prompt copied.`
            : 'Could not reach the pasteboard.',
        })
      })
      .catch(() => {
        setStatus({ failed: true, text: 'Could not reach the pasteboard.' })
      })
  }

  return (
    <View
      className={cn(
        'gap-1.5 border-b px-3 py-2',
        ready ? 'border-success/30 bg-success/5' : 'border-border bg-muted/30',
      )}
      testID="porcelain-review-lifecycle"
    >
      <View className="flex-row items-center gap-2">
        {badge === null ? null : (
          <Text
            className={cn(
              'shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest',
              ready ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
            )}
            testID="porcelain-review-lifecycle-badge"
          >
            {badge}
          </Text>
        )}
        <Text className="min-w-0 flex-1 text-[11px] leading-4 text-muted-foreground">
          {lifecycleDetail(reading, effective)}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Button
          accessibilityLabel={ready ? 'Copy the end-unit prompt' : 'Copy the continue prompt'}
          accessibilityRole="button"
          size="sm"
          testID="porcelain-review-copy-prompt"
          variant="outline"
          onPress={handleCopy}
        >
          <ChromeGlyph name="copy" size={13} />
          <UiText className="text-xs">{ready ? 'Copy end prompt' : 'Copy continue prompt'}</UiText>
        </Button>
        {status === null ? null : (
          <StatusNote
            failed={status.failed}
            testID="porcelain-review-prompt-status"
            text={status.text}
          />
        )}
      </View>
    </View>
  )
}
