import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import {
  ConfirmDialog,
  ErrorNote,
  IconAction,
  PanelLabel,
  StatusNote,
} from '@/components/panel-chrome'
import { ShellModal, useShellModalSize } from '@/components/shell-modal'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { CommentsCard } from '@/features/changes/comments-card'
import { useReviewedPaths } from '@/features/changes/use-changes'
import { useReviewComments } from '@/features/comments/use-comments'
import { pathTestId } from '@/features/files/file-paths'
import { copyText } from '@/lib/clipboard'
import type { ArchivedReview, FeatureReading } from '@/lib/daemon/procedures/review'
import { cn } from '@/lib/utils'

import {
  lifecycleBadgeLabel,
  lifecycleDetail,
  reviewContinuePrompt,
  reviewEndPrompt,
  reviewedFractionOf,
  reviewLifecyclePhase,
  reviewStartPrompt,
} from './review-lifecycle'
import { useReviewStore } from './review-store'
import {
  useArchivedReviewActions,
  useArchivedReviews,
  useFeatureReading,
  useReviewActions,
  useReviewPublishCost,
} from './use-review'

/**
 * The Review companion — "Now reading".
 *
 * The web rail's order, kept: what the current unit is and where it stands, the two
 * consequential writes that end it, the previous units you can bring back, and the comments
 * channel the agent reads. One component for both hosts — the tablet inspector column and the
 * phone's bolt sheet — so the two can never drift into different companions for one surface.
 */
export function ReviewCompanion({ active }: { active: boolean }): React.JSX.Element {
  const { reading } = useFeatureReading(active)

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-5 px-[16px] pb-8 pt-3"
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
        <>
          <NowReadingCard active={active} reading={reading} />
          <ReviewWritesCard reading={reading} />
        </>
      )}
      <PreviousReviewsCard active={active} />
      <CommentsCard active={active} />
    </ScrollView>
  )
}

/** No active unit: the companion says the same thing the canvas does, in one card. */
function StartUnitCard(): React.JSX.Element {
  const [status, setStatus] = useState<{ failed: boolean; text: string } | null>(null)

  return (
    <View className="gap-2" testID="porcelain-review-companion-start">
      <PanelLabel>Review</PanelLabel>
      <View className="gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-3">
        <Text className="text-[11px] leading-4 text-muted-foreground">
          Start a unit: copy the begin-unit prompt (name + thesis) and hand it to your agent, which
          publishes Intent first. Archive the previous unit when it is done so it stays in Previous
          reviews.
        </Text>
        <Button
          accessibilityLabel="Copy the begin-unit prompt"
          accessibilityRole="button"
          size="sm"
          testID="porcelain-review-companion-start-prompt"
          variant="outline"
          onPress={() => {
            copyText(reviewStartPrompt())
              .then((copied) => {
                setStatus({
                  failed: !copied,
                  text: copied ? 'Begin-unit prompt copied.' : 'Could not reach the pasteboard.',
                })
              })
              .catch(() => {
                setStatus({ failed: true, text: 'Could not reach the pasteboard.' })
              })
          }}
        >
          <ChromeGlyph name="copy" size={13} />
          <UiText className="text-xs">Copy begin-unit prompt</UiText>
        </Button>
        {status === null ? null : (
          <StatusNote
            failed={status.failed}
            testID="porcelain-review-companion-start-status"
            text={status.text}
          />
        )}
      </View>
    </View>
  )
}

/** The current unit: phase, what it still needs, and the prompt that moves it on. */
function NowReadingCard({
  active,
  reading,
}: {
  active: boolean
  reading: FeatureReading
}): React.JSX.Element {
  const reviewed = useReviewedPaths(active)
  // Shares the CommentsCard's cache entry below, so the count costs no extra read.
  const comments = useReviewComments(active)
  const canvasTab = useReviewStore((state) => state.canvasTab)
  const [status, setStatus] = useState<{ failed: boolean; text: string } | null>(null)

  const { fraction, reviewedCount, total } = reviewedFractionOf(reading, reviewed)
  const phase = reviewLifecyclePhase({ reading, reviewedFraction: fraction })
  const effective = phase === 'empty' ? 'in_progress' : phase
  const ready = effective === 'ready_to_close'
  const badge = lifecycleBadgeLabel(effective)
  const openComments = comments.filter((comment) => !comment.resolved).length

  return (
    <View className="gap-2" testID="porcelain-review-now-reading">
      <PanelLabel>Now reading</PanelLabel>
      <View
        className={cn(
          'gap-1.5 rounded-2xl border p-3',
          ready ? 'border-success/30 bg-success/5' : 'border-border bg-card',
        )}
      >
        <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
          {reading.name}
        </Text>
        {badge === null ? null : (
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {badge}
            {total === 0 ? ' · previous unit still up' : ''}
          </Text>
        )}
        <Text className="text-[11px] leading-4 text-muted-foreground">
          {lifecycleDetail(reading, effective)}
        </Text>
        <Text className="text-[11px] text-muted-foreground/80">
          {CANVAS_LABEL[canvasTab]}
          {total === 0 ? '' : ` · ${reviewedCount}/${total} reviewed`}
          {openComments === 0
            ? ''
            : ` · ${openComments} open comment${openComments === 1 ? '' : 's'}`}
        </Text>
        <Button
          accessibilityLabel={ready ? 'Copy the end-unit prompt' : 'Copy the continue prompt'}
          accessibilityRole="button"
          className="mt-1"
          size="sm"
          testID="porcelain-review-companion-prompt"
          variant="outline"
          onPress={() => {
            const prompt = ready
              ? reviewEndPrompt(reading.name)
              : reviewContinuePrompt(reading.name)
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
          }}
        >
          <ChromeGlyph name="copy" size={13} />
          <UiText className="text-xs">{ready ? 'Copy end prompt' : 'Copy continue prompt'}</UiText>
        </Button>
        {status === null ? null : (
          <StatusNote
            failed={status.failed}
            testID="porcelain-review-companion-prompt-status"
            text={status.text}
          />
        )}
      </View>
    </View>
  )
}

const CANVAS_LABEL: Record<'intent' | 'execution' | 'evidence', string> = {
  evidence: 'Reading Evidence',
  execution: 'Reading Execution',
  intent: 'Reading Intent',
}

/**
 * The two writes that end a unit.
 *
 * Both keep the ceremony they have on the desktop. Publishing force-stages the review past
 * the ignore rule that keeps reviews local, so it names the byte cost first — git history
 * does not forget a 30 MB evidence pack. Archiving moves the whole unit off the active slots,
 * so it confirms. A small screen is a reason to make the sheet clear, not a reason to make
 * either of them a single tap.
 */
function ReviewWritesCard({ reading }: { reading: FeatureReading }): React.JSX.Element {
  const { archive, isPending, publish } = useReviewActions()
  const [publishOpen, setPublishOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [published, setPublished] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cost = useReviewPublishCost(publishOpen)
  const { width } = useShellModalSize()

  const guard = (label: string, run: () => Promise<void>): void => {
    setError(null)
    run().catch((cause: unknown) => {
      setError(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  return (
    <View className="gap-2" testID="porcelain-review-writes">
      <PanelLabel>This unit</PanelLabel>
      <Button
        accessibilityLabel="Publish this review to the repo"
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
        <UiText className="text-xs">Publish review to the repo</UiText>
      </Button>
      {published === null ? null : (
        <Text
          className="font-mono text-[10px] leading-4 text-muted-foreground"
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
              disabled={isPending}
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
function PreviousReviewsCard({ active }: { active: boolean }): React.JSX.Element | null {
  const archived = useArchivedReviews(active)
  const { isPending, remove, restore } = useArchivedReviewActions()
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ArchivedReview | null>(null)

  if (archived.length === 0) return null

  const guard = (label: string, run: () => Promise<void>): void => {
    setError(null)
    run().catch((cause: unknown) => {
      setError(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  return (
    <View className="gap-2" testID="porcelain-review-previous">
      <PanelLabel>{`Previous reviews · ${archived.length}`}</PanelLabel>
      <View className="gap-1.5">
        {archived.map((row) => (
          <View
            key={row.id}
            className="flex-row items-start gap-1 rounded-2xl border border-border bg-card p-2.5"
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
              <Text className="text-[10px] text-muted-foreground">
                {formatArchivedAt(row.archivedAt)}
              </Text>
              {row.thesis === undefined ? null : (
                <Text className="text-[11px] leading-4 text-muted-foreground" numberOfLines={2}>
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
