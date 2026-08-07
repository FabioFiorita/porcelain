import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote, ErrorNote, PanelLabel } from '@/components/panel-chrome'
import { useReviewedPaths } from '@/features/changes/use-changes'
import { pathTestId } from '@/features/files/file-paths'
import type { EvidenceMeta } from '@/lib/daemon/procedures/review'
import { cn } from '@/lib/utils'

import { executionBlocks } from './execution-rows'
import { reviewedFractionOf } from './review-lifecycle'
import { type ReviewCanvasTab, useReviewStore } from './review-store'
import { useFeatureReading } from './use-review'

/**
 * The Review outline — the tablet's supplementary column.
 *
 * A table of contents for the one active unit, not a list of units: the walkthrough sections
 * the agent wrote, the "More files" groups under them, and the two chapters that bracket
 * them. Tapping a row moves the canvas beside it — a chapter switches tab, a block switches to
 * Execution and scrolls to that block.
 *
 * Blocks come from the same builder the Execution canvas renders from, so a block that is
 * empty after dedup is missing from both, and the count on a row is the count you land on.
 */
export function ReviewList({ active }: { active: boolean }): React.JSX.Element {
  const { error, isLoading, reading } = useFeatureReading(active)
  const reviewed = useReviewedPaths(active && reading !== null && reading !== undefined)
  const canvasTab = useReviewStore((state) => state.canvasTab)
  const focusBlock = useReviewStore((state) => state.focusExecutionBlock)
  const focus = useReviewStore((state) => state.executionFocus)
  const setCanvasTab = useReviewStore((state) => state.setCanvasTab)

  if (error !== null) {
    return (
      <View className="flex-1 bg-background p-3" testID="porcelain-review-list">
        <ErrorNote message={error.message} testID="porcelain-review-list-error" />
      </View>
    )
  }

  if (reading === undefined) {
    return (
      <View className="flex-1 bg-background" testID="porcelain-review-list">
        <Text
          className="px-4 py-6 text-sm text-muted-foreground"
          testID={isLoading ? 'porcelain-review-list-loading' : 'porcelain-review-list-idle'}
        >
          {isLoading ? 'Loading the Review…' : 'No daemon connected.'}
        </Text>
      </View>
    )
  }

  if (reading === null) {
    return (
      <View className="flex-1 bg-background" testID="porcelain-review-list">
        <EmptyNote
          body="No unit is open. Copy the begin-unit prompt from the canvas and hand it to your agent."
          testID="porcelain-review-list-empty"
          title="No review yet"
        />
      </View>
    )
  }

  const { blocks } = executionBlocks(reading)
  const { reviewedCount, total } = reviewedFractionOf(reading, reviewed)

  return (
    <View className="flex-1 bg-background" testID="porcelain-review-list">
      <View className="gap-1 px-4 pb-2 pt-3">
        <Text className="text-xs font-semibold text-foreground" numberOfLines={2}>
          {reading.name}
        </Text>
        <Text
          className={cn(
            'text-[11px]',
            total > 0 && reviewedCount === total ? 'text-success' : 'text-muted-foreground',
          )}
          testID="porcelain-review-list-progress"
        >
          {total === 0
            ? 'No files listed yet'
            : `${reviewedCount} of ${total} ${total === 1 ? 'file' : 'files'} reviewed`}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-0.5 px-4 pb-8"
        showsVerticalScrollIndicator={false}
        testID="porcelain-review-outline"
      >
        <ChapterRow
          glyph="notebook"
          label="Intent"
          detail="Why this unit exists"
          selected={canvasTab === 'intent'}
          tab="intent"
          testID="porcelain-review-outline-intent"
          onPress={setCanvasTab}
        />

        <View className="pb-1 pt-3">
          <PanelLabel>Execution</PanelLabel>
        </View>
        {blocks.length === 0 ? (
          <Text
            className="px-2 py-2 text-[11px] leading-4 text-muted-foreground"
            testID="porcelain-review-outline-no-blocks"
          >
            No files listed yet — the agent adds them with review set --files.
          </Text>
        ) : (
          blocks.map((block) => (
            <Pressable
              key={block.id}
              accessibilityLabel={`${block.title}, ${block.fileCount} ${block.fileCount === 1 ? 'file' : 'files'}`}
              accessibilityRole="button"
              accessibilityState={{
                selected: canvasTab === 'execution' && focus?.blockId === block.id,
              }}
              className={cn(
                'min-h-11 flex-row items-center gap-2 rounded-xl px-2 py-2 active:bg-accent',
                canvasTab === 'execution' && focus?.blockId === block.id && 'bg-muted/70',
              )}
              testID={pathTestId('porcelain-review-outline-block', block.id)}
              onPress={() => {
                focusBlock(block.id)
              }}
            >
              <Text className="min-w-0 flex-1 text-[13px] text-foreground" numberOfLines={1}>
                {block.title}
              </Text>
              <Text className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {block.fileCount}
              </Text>
              <ChromeGlyph name="chevronRight" size={12} />
            </Pressable>
          ))
        )}

        <View className="pb-1 pt-3">
          <PanelLabel>Proof</PanelLabel>
        </View>
        <ChapterRow
          glyph="circleCheck"
          label={reading.evidence?.title ?? 'Evidence'}
          detail={evidenceDetail(reading.evidence)}
          selected={canvasTab === 'evidence'}
          tab="evidence"
          testID="porcelain-review-outline-evidence"
          onPress={setCanvasTab}
        />
      </ScrollView>
    </View>
  )
}

/** The chapter row's one line about the proof: what it claims, or that there is none. */
function evidenceDetail(meta: EvidenceMeta | null): string {
  if (meta === null) return 'Nothing published yet'
  const checks = meta.checks
  if (checks.length === 0) return 'Published, no checks recorded'
  const failed = checks.filter((check) => check.status === 'fail').length
  return failed > 0
    ? `${failed} of ${checks.length} failed`
    : `${checks.length} ${checks.length === 1 ? 'check' : 'checks'} passed`
}

/** Intent and Evidence are chapters, not blocks: they own a canvas rather than a scroll spot. */
function ChapterRow({
  detail,
  glyph,
  label,
  onPress,
  selected,
  tab,
  testID,
}: {
  detail: string
  glyph: 'notebook' | 'circleCheck'
  label: string
  onPress: (tab: ReviewCanvasTab) => void
  selected: boolean
  tab: ReviewCanvasTab
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`${label} — ${detail}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'min-h-12 flex-row items-center gap-2.5 rounded-xl px-2 py-2 active:bg-accent',
        selected && 'bg-muted/70',
      )}
      testID={testID}
      onPress={() => {
        onPress(tab)
      }}
    >
      <ChromeGlyph name={glyph} size={15} tone={selected ? 'primary' : 'muted'} />
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </Pressable>
  )
}
