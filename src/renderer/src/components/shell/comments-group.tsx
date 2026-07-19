import type { ReviewComment } from '@backend/comment-store'
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { useCommentActions, useReviewComments } from '@renderer/hooks/use-comments'
import { fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { Check, Eraser, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'

function anchorLabel(comment: ReviewComment): string {
  const name = fileName(comment.path)
  if (comment.startLine === undefined) return name
  if (comment.endLine && comment.endLine !== comment.startLine) {
    return `${name}:${comment.startLine}–${comment.endLine}`
  }
  return `${name}:${comment.startLine}`
}

function CommentRow({ comment }: { comment: ReviewComment }): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const { remove, setResolved } = useCommentActions()

  const open = (): void => {
    if (!repo) return
    const absolute = `${repo.path}/${comment.path}`
    openTab({
      id: tabId('file', absolute),
      kind: 'file',
      title: fileName(comment.path),
      path: absolute,
      ...(comment.startLine ? { line: comment.startLine } : {}),
    })
  }

  return (
    <div
      className={cn(
        'group/comment flex flex-col gap-1 rounded-xl border bg-card p-2',
        comment.resolved && 'opacity-55',
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={open}
          className="min-w-0 flex-1 truncate text-left font-mono text-xs-minus text-muted-foreground hover:text-foreground"
          title={`${comment.path}${comment.startLine ? `:${comment.startLine}` : ''}`}
        >
          {anchorLabel(comment)}
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-5 opacity-0 group-hover/comment:opacity-100 [@media(hover:none)]:opacity-100"
          aria-label={comment.resolved ? 'Reopen comment' : 'Resolve comment'}
          onClick={() => setResolved(comment.id, !comment.resolved)}
        >
          {comment.resolved ? <RotateCcw /> : <Check />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-5 opacity-0 group-hover/comment:opacity-100 hover:text-destructive [@media(hover:none)]:opacity-100"
          aria-label="Delete comment"
          onClick={() => remove(comment.id)}
        >
          <Trash2 />
        </Button>
      </div>
      <button
        type="button"
        onClick={open}
        className={cn(
          'line-clamp-3 text-left text-xs',
          comment.resolved && 'text-muted-foreground line-through',
        )}
      >
        {comment.body}
      </button>
      {comment.agentReply && (
        <div className="mt-0.5 flex flex-col gap-0.5 border-l-2 border-border pl-2">
          <span className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Agent
          </span>
          <p className="text-xs text-muted-foreground">{comment.agentReply.body}</p>
        </div>
      )}
    </div>
  )
}

/**
 * Bulk-erase resolved comments — the Comments equivalent of the board's Done
 * clear. Hidden while nothing is closed. Confirms first (comments aren't recoverable).
 */
function ClearResolvedButton({ count }: { count: number }): React.JSX.Element | null {
  const { clearResolved } = useCommentActions()
  const [confirm, setConfirm] = useState(false)
  if (count === 0) return null
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-5"
        aria-label="Clear closed comments"
        onClick={() => setConfirm(true)}
      >
        <Eraser />
      </Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear closed comments?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {count} closed {count === 1 ? 'comment' : 'comments'}. Open
              comments are left alone. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => clearResolved()}>
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function CommentsGroup(): React.JSX.Element {
  const comments = useReviewComments()
  const open = comments.filter((c) => !c.resolved).length
  const closed = comments.length - open

  return (
    <SidebarGroup className="px-3">
      <div className="flex items-center justify-between gap-1">
        <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Comments{open > 0 && ` · ${open} open`}
        </SidebarGroupLabel>
        <ClearResolvedButton count={closed} />
      </div>
      <SidebarGroupContent className="flex flex-col gap-1.5 px-1">
        {comments.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            Select lines in a diff (or right-click a file) and “Add comment” — your agent reads them
            as review context.
          </p>
        ) : (
          comments.map((comment) => <CommentRow key={comment.id} comment={comment} />)
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
