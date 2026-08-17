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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useCommentActions, useReviewComments } from '@renderer/features/review'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { Check, Eraser, MessageSquare, Trash2 } from 'lucide-react'
import { useState } from 'react'

/**
 * Changes-header hygiene for the worktree's comments: resolve all, clear the
 * resolved ones, or wipe the list. Comments stay inline on the file; this is
 * the desk, not a second Comments surface.
 */
export function CommentsManageMenu(): React.JSX.Element | null {
  const comments = useReviewComments()
  const { setResolved, clearResolved, remove } = useCommentActions()
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  if (comments.length === 0) return null

  const resolvedCount = comments.filter((comment) => comment.resolved).length
  const openCount = comments.length - resolvedCount

  const resolveAll = (): void => {
    runUserAction(
      async () => {
        for (const comment of comments) {
          if (!comment.resolved) await setResolved(comment.id, true)
        }
      },
      (error) => {
        toastUserActionError('Resolve comments', error)
      },
    )
  }

  const clearClosed = (): void => {
    runUserAction(
      () => clearResolved(),
      (error) => {
        toastUserActionError('Clear resolved comments', error)
      },
    )
  }

  const deleteAll = (): void => {
    runUserAction(
      async () => {
        for (const comment of comments) await remove(comment.id)
      },
      (error) => {
        toastUserActionError('Delete comments', error)
      },
    )
  }

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0"
                    aria-label="Comments"
                    data-testid={TestIds.commentsManage}
                  >
                    <MessageSquare className="size-3" />
                  </Button>
                }
              />
            }
          />
          <TooltipContent>Comments</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {openCount} open · {resolvedCount} resolved
            </DropdownMenuLabel>
            <DropdownMenuItem
              disabled={openCount === 0}
              data-testid={TestIds.commentsResolveAll}
              onClick={resolveAll}
            >
              <Check />
              Resolve all
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={resolvedCount === 0}
              data-testid={TestIds.commentsClearResolved}
              onClick={clearClosed}
            >
              <Eraser />
              Clear resolved
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              data-testid={TestIds.commentsDeleteAll}
              onClick={() => setConfirmDeleteAll(true)}
            >
              <Trash2 />
              Delete all comments
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all comments?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {comments.length} {comments.length === 1 ? 'comment' : 'comments'} from
              the review. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid={TestIds.commentsDeleteAllConfirm}
              onClick={deleteAll}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
