import type { ArchivedReview, FeatureReading } from '@porcelain/contracts/review'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ChromeGlyph } from '@/components/chrome-glyph'
import {
  ConfirmDialog,
  EmptyNote,
  ErrorNote,
  IconAction,
  PanelLabel,
} from '@/components/panel-chrome'
import { ShellModal, useShellModalSize } from '@/components/shell-modal'
import { PANEL_CARD } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { CommentsCard } from '@/features/changes/comments-card'
import { useReviewedPaths } from '@/features/changes/use-changes'
import { useReviewComments } from '@/features/comments'
import { pathTestId } from '@/features/files'
import { useCompanionGitVisibility } from '@/features/project-data'
import { cn } from '@/lib/utils'

import { reviewedFractionOf } from './review-lifecycle'
import { useArchivedReviews, useFeatureReading, useReviewPublishCost } from './use-review'
import { useArchivedReviewActions, useReviewActions } from './use-review-actions'

/**
 * The Review companion.
 *
 * The web rail's order, kept: what the current unit is and the two consequential writes that
 * end it, the previous units you can bring back, and the comments channel the agent reads.
 * One component for both hosts — the tablet inspector column and the phone's bolt sheet — so
 * the two can never drift into different companions for one surface.
 */
export function ReviewCompanion({ active }: { active: boolean }): React.JSX.Element {
  const { reading } = useFeatureReading(active)

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-5 px-4 pb-8 pt-3"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      testID="porcelain-review-companion"
    >
      {/* One card while the first read is still in flight and while there is no unit at all:
          both are "nothing to say about a current review", and a skeleton would be noise. */}
      {reading === null || reading === undefined ? (
        <StartUnitCard />
      ) : (
        <ReviewCurrentCard active={active} reading={reading} />
      )}
      <PreviousReviewsCard active={active} />
      <CommentsCard active={active} />
    </ScrollView>
  )
}

/** No active unit: the companion says the same thing the canvas does, in one card. */
function StartUnitCard(): React.JSX.Element {
  return (
    <View className="gap-2" testID="porcelain-review-companion-start">
      <PanelLabel>Review</PanelLabel>
      <View className="gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-3">
        <Text className="text-2xs leading-4 text-muted-foreground">
          No active unit. Ask your agent to start one — it publishes Intent first (name + thesis),
          then grows Execution and Evidence. Archive a finished unit and it stays in Previous
          reviews.
        </Text>
      </View>
    </View>
  )
}

/**
 * The current unit and the two writes that end it.
 *
 * Both writes keep the ceremony they have on the desktop. Publishing force-stages the review
 * past the ignore rule that keeps reviews local, so it names the byte cost — and, when this
 * clone hides Porcelain from git at all, what publishing reveals — before it runs. Archiving
 * moves the whole unit off the active slots, so it confirms. A small screen is a reason to
 * make the sheet clear, not a reason to make either of them a single tap.
 */
function ReviewCurrentCard({
  active,
  reading,
}: {
  active: boolean
  reading: FeatureReading
}): React.JSX.Element {
  const { archive, isPending, publish } = useReviewActions()
  const [publishOpen, setPublishOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [published, setPublished] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cost = useReviewPublishCost(publishOpen)
  const { width } = useShellModalSize()
  const visibility = useCompanionGitVisibility(publishOpen)
  const reviewed = useReviewedPaths(active)
  // Shares the CommentsCard's cache entry below, so the count costs no extra read.
  const comments = useReviewComments(active)
  const { reviewedCount, total } = reviewedFractionOf(reading, reviewed)
  const openComments = comments.filter((comment) => !comment.resolved).length

  const guard = (label: string, run: () => Promise<void>): void => {
    setError(null)
    run().catch((cause: unknown) => {
      setError(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  return (
    <View className="gap-2" testID="porcelain-review-current">
      <PanelLabel>Current review</PanelLabel>
      <View className={cn('gap-1 p-3', PANEL_CARD)}>
        <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
          {reading.name}
        </Text>
        {total === 0 && openComments === 0 ? null : (
          <Text className="text-2xs text-muted-foreground" testID="porcelain-review-current-meta">
            {total === 0 ? '' : `${reviewedCount}/${total} reviewed`}
            {total === 0 || openComments === 0 ? '' : ' · '}
            {openComments === 0
              ? ''
              : `${openComments} open comment${openComments === 1 ? '' : 's'}`}
          </Text>
        )}
      </View>
      <Button
        accessibilityLabel="Publish review"
        accessibilityRole="button"
        disabled={isPending}
        size="sm"
        testID="porcelain-review-publish"
        variant="outline"
        onPress={() => {
          setPublishOpen(true)
        }}
      >
        <ChromeGlyph name="arrowUpFromLine" size={13} />
        <UiText className="text-xs">Publish review</UiText>
      </Button>
      {published === null ? null : (
        <Text
          className="font-mono text-3xs leading-4 text-muted-foreground"
          testID="porcelain-review-published"
        >
          Staged .porcelain/reviews/{published} — commit it in Changes to share.
        </Text>
      )}
      <Button
        accessibilityLabel="Archive this review and its evidence"
        accessibilityRole="button"
        disabled={isPending}
        size="sm"
        testID="porcelain-review-archive"
        variant="outline"
        onPress={() => {
          setArchiveOpen(true)
        }}
      >
        <ChromeGlyph name="archive" size={13} tone="destructive" />
        <UiText className="text-xs text-destructive">Archive review &amp; evidence</UiText>
      </Button>
      {error === null ? null : <ErrorNote message={error} testID="porcelain-review-write-error" />}

      <ShellModal
        contentStyle={{ width }}
        description={`Archives “${reading.name}” under .porcelain/reviews/ and stages it, past the ignore rule that keeps reviews local. Nothing is committed — that stays yours.`}
        open={publishOpen}
        title="Publish this review?"
        onClose={() => {
          setPublishOpen(false)
        }}
      >
        <View className="gap-4" testID="porcelain-review-publish-dialog">
          <Text
            className="text-xs leading-5 text-muted-foreground"
            testID="porcelain-review-publish-cost"
          >
            {cost === undefined
              ? 'Measuring…'
              : `Adds about ${formatBytes(cost.bytes)} across ${cost.files} ${
                  cost.files === 1 ? 'file' : 'files'
                } to git history — permanently.`}
          </Text>
          {visibility.isPending ? (
            <Text
              className="text-xs leading-5 text-muted-foreground"
              testID="porcelain-review-publish-hidden"
            >
              Checking this clone&rsquo;s git visibility…
            </Text>
          ) : visibility.hidden === true ? (
            <Text
              className="text-xs leading-5 text-muted-foreground"
              testID="porcelain-review-publish-hidden"
            >
              Porcelain data is currently hidden from Git in this clone — publishing lifts that,
              exposing every Shared channel (not just this review) to git status.
            </Text>
          ) : null}
          <View className="flex-row justify-end gap-2">
            <Button
              testID="porcelain-review-publish-dialog-cancel"
              variant="ghost"
              onPress={() => {
                setPublishOpen(false)
              }}
            >
              <UiText>Cancel</UiText>
            </Button>
            <Button
              disabled={isPending || visibility.isPending}
              testID="porcelain-review-publish-dialog-confirm"
              onPress={() => {
                setPublishOpen(false)
                guard('Publish failed', async () => {
                  setPublished(await publish())
                })
              }}
            >
              <UiText>Publish</UiText>
            </Button>
          </View>
        </View>
      </ShellModal>

      <ConfirmDialog
        body="Moves the Review — Intent, walkthrough, comments and evidence — into .porcelain/reviews/ so you can restore it later. The active unit becomes empty until the agent publishes again or you restore a previous review."
        confirmLabel="Archive"
        open={archiveOpen}
        testID="porcelain-review-archive-confirm"
        title="Archive review and evidence?"
        onCancel={() => {
          setArchiveOpen(false)
        }}
        onConfirm={() => {
          setArchiveOpen(false)
          setPublished(null)
          guard('Archive failed', archive)
        }}
      />
    </View>
  )
}

/** Previous units under `.porcelain/reviews/` — restore one, or delete it for good. */
function PreviousReviewsCard({ active }: { active: boolean }): React.JSX.Element {
  const archived = useArchivedReviews(active)
  const { isPending, remove, restore } = useArchivedReviewActions()
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ArchivedReview | null>(null)

  const guard = (label: string, run: () => Promise<void>): void => {
    setError(null)
    run().catch((cause: unknown) => {
      setError(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  return (
    <View className="gap-2" testID="porcelain-review-previous">
      <PanelLabel>
        {archived.length === 0 ? 'Previous reviews' : `Previous reviews · ${archived.length}`}
      </PanelLabel>
      {archived.length === 0 ? (
        <EmptyNote
          body="Archived units land here."
          testID="porcelain-review-previous-empty"
          title="No previous reviews yet"
        />
      ) : null}
      <View className="gap-1.5">
        {archived.map((row) => (
          <View
            key={row.id}
            className={cn('flex-row items-start gap-1 p-2.5', PANEL_CARD)}
            testID={pathTestId('porcelain-review-previous-row', row.id)}
          >
            <Pressable
              accessibilityLabel={`Restore review ${row.name}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isPending }}
              className="min-w-0 flex-1 gap-0.5"
              disabled={isPending}
              testID={pathTestId('porcelain-review-previous-restore', row.id)}
              onPress={() => {
                guard('Restore failed', () => restore(row.id))
              }}
            >
              <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                {row.name}
              </Text>
              <Text className="text-3xs text-muted-foreground">
                {formatArchivedAt(row.archivedAt)}
              </Text>
              {row.thesis === undefined ? null : (
                <Text className="text-2xs leading-4 text-muted-foreground" numberOfLines={2}>
                  {row.thesis}
                </Text>
              )}
            </Pressable>
            <IconAction
              accessibilityLabel={`Delete archived review ${row.name}`}
              disabled={isPending}
              glyph="trash"
              testID={pathTestId('porcelain-review-previous-delete', row.id)}
              tone="destructive"
              onPress={() => {
                setPendingDelete(row)
              }}
            />
          </View>
        ))}
      </View>
      {error === null ? null : (
        <ErrorNote message={error} testID="porcelain-review-previous-error" />
      )}

      <ConfirmDialog
        body={
          pendingDelete === null
            ? ''
            : `This permanently deletes “${pendingDelete.name}” and everything archived with it — intent, comments and evidence. It cannot be undone.`
        }
        confirmLabel="Delete"
        open={pendingDelete !== null}
        testID="porcelain-review-previous-delete-confirm"
        title="Delete this archived review?"
        onCancel={() => {
          setPendingDelete(null)
        }}
        onConfirm={() => {
          const target = pendingDelete
          setPendingDelete(null)
          if (target === null) return
          guard('Delete failed', () => remove(target.id))
        }}
      />
    </View>
  )
}

/** Bytes as the publish warning says them — the same shape the desktop's dialog uses. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatArchivedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  })
}
