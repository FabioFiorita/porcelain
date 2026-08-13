import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import { useCompanionGitVisibility } from '@renderer/features/project-data'
import { usePublishReview, useReviewPublishCost } from '@renderer/features/review'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { cn } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { Share2 } from 'lucide-react'
import { useState } from 'react'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Publish the active review: archive it under `.porcelain/reviews/<id>/` and
 * stage that folder for the team.
 *
 * Reviews are Local by default, so this is the deliberate act that makes one
 * shareable — and it names the byte cost first. Evidence packs are why: a review
 * is worth sharing, and a large capture inside it is worth knowing about before
 * it lands, because git history does not forget.
 */
export function PublishReviewButton({ className }: { className?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const cost = useReviewPublishCost(open)
  const { data: visibility, isPending: visibilityPending } = useCompanionGitVisibility()
  const { publish, isPublishing } = usePublishReview()
  const [published, setPublished] = useState<string | null>(null)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(className, 'w-full justify-start')}
        disabled={isPublishing}
        data-testid={TestIds.reviewPublish}
        onClick={() => setOpen(true)}
      >
        <Share2 />
        Publish review
      </Button>
      {published !== null && (
        <p className="text-2xs text-muted-foreground">
          Staged <span className="font-mono">.porcelain/reviews/{published}</span>. Commit it to
          share.
        </p>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this review?</AlertDialogTitle>
            <AlertDialogDescription>
              Archives the review — intent, walkthrough, comments and evidence — under
              <span className="font-mono"> .porcelain/reviews/</span> and stages it, past the ignore
              rule that keeps reviews local. Nothing is committed; that stays yours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Publishing lifts the clone-wide hide as a side effect — say so before
              the click, not after `.porcelain/` shows up in git status. Gated on the
              query resolving so a slow daemon can't let Publish through before we know
              whether this clone is hidden. */}
          {visibilityPending ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid={TestIds.reviewPublishVisibilityNote}
            >
              Checking this clone&rsquo;s git visibility…
            </p>
          ) : (
            visibility?.hidden === true && (
              <p className="text-xs text-warning" data-testid={TestIds.reviewPublishVisibilityNote}>
                Porcelain data is currently hidden from Git in this clone — publishing lifts that,
                exposing every <span className="font-mono">Shared</span> channel (not just this
                review) to git status.
              </p>
            )
          )}
          <p className="text-xs text-muted-foreground" data-testid={TestIds.reviewPublishCost}>
            {cost === undefined
              ? 'Measuring…'
              : `Adds about ${formatBytes(cost.bytes)} across ${cost.files} ${
                  cost.files === 1 ? 'file' : 'files'
                } to git history — permanently.`}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPublishing || visibilityPending}
              data-testid={TestIds.reviewPublishConfirm}
              onClick={() => {
                runUserAction(
                  async () => {
                    setPublished(await publish())
                  },
                  (error) => {
                    toastUserActionError('Publish review', error)
                  },
                )
              }}
            >
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
