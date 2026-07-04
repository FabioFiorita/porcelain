import type { ReviewComment } from '@backend/comment-store'
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
import { Check, RotateCcw, Trash2 } from 'lucide-react'

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
        'group/comment glaze-tile flex flex-col gap-1 p-2 [--tile-fill:var(--surface-2)]',
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
          className="size-5 opacity-0 group-hover/comment:opacity-100"
          aria-label={comment.resolved ? 'Reopen comment' : 'Resolve comment'}
          onClick={() => setResolved(comment.id, !comment.resolved)}
        >
          {comment.resolved ? <RotateCcw /> : <Check />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-5 opacity-0 group-hover/comment:opacity-100 hover:text-destructive"
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
    </div>
  )
}

export function CommentsGroup(): React.JSX.Element {
  const comments = useReviewComments()
  const open = comments.filter((c) => !c.resolved).length

  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Comments{open > 0 && ` · ${open} open`}
      </SidebarGroupLabel>
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
