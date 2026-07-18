import type { ReviewComment } from '@backend/comment-store'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useCommentActions } from '@renderer/hooks/use-comments'
import { cn } from '@renderer/lib/utils'
import { Check, MessageSquare, RotateCcw, Trash2 } from 'lucide-react'

// One comment inside the marker popover: the body, the agent's reply (mirroring the
// sidebar CommentsGroup styling), and resolve/delete actions. Read-only on the body —
// editing lives in the sidebar; here you read, resolve, and delete where the line is.
function CommentCard({ comment }: { comment: ReviewComment }): React.JSX.Element {
  const { remove, setResolved } = useCommentActions()
  return (
    <div className={cn('flex flex-col gap-1', comment.resolved && 'opacity-55')}>
      <div className="flex items-start gap-1">
        <p
          className={cn(
            'min-w-0 flex-1 whitespace-pre-wrap break-words text-xs',
            comment.resolved && 'text-muted-foreground line-through',
          )}
        >
          {comment.body}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-5 shrink-0"
          aria-label={comment.resolved ? 'Reopen comment' : 'Resolve comment'}
          onClick={() => setResolved(comment.id, !comment.resolved)}
        >
          {comment.resolved ? <RotateCcw /> : <Check />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-5 shrink-0 hover:text-destructive"
          aria-label="Delete comment"
          onClick={() => remove(comment.id)}
        >
          <Trash2 />
        </Button>
      </div>
      {comment.agentReply && (
        <div className="mt-0.5 flex flex-col gap-0.5 border-l-2 border-border pl-2">
          <span className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Agent
          </span>
          <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
            {comment.agentReply.body}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * A gutter glyph for a commented line: click it to read that line's comment(s) in a
 * popover and resolve/delete them. Positioned by the caller (absolutely, in the line
 * gutter) so it never changes a virtualized row's fixed height. Renders nothing when
 * there are no comments. A line with only resolved comments dims the glyph.
 */
export function CommentMarker({
  comments,
}: {
  comments: readonly ReviewComment[]
}): React.JSX.Element | null {
  if (comments.length === 0) return null
  const openCount = comments.filter((c) => !c.resolved).length
  const label = `${comments.length} comment${comments.length === 1 ? '' : 's'}${
    openCount > 0 ? `, ${openCount} open` : ''
  }`
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={label}
            title={label}
            className={cn(
              'flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              openCount === 0 && 'opacity-40',
            )}
          >
            <MessageSquare className="size-3.5" />
          </button>
        }
      />
      <PopoverContent align="start" side="right" className="w-80 gap-2 p-2">
        <div className="flex flex-col gap-2">
          {comments.map((comment) => (
            <CommentCard key={comment.id} comment={comment} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * The comment overlay for one code/diff line: a full-row tint (white-alpha for an
 * existing open comment; the primary highlight while the composer is anchored here)
 * plus a gutter glyph opening the comment popover. Both are absolutely positioned so a
 * fixed-height virtualized row never changes height. A line with only resolved comments
 * gets the dimmed glyph and no tint. The host row must be `relative`.
 */
export function LineDecorations({
  comments,
  pending = false,
}: {
  comments: readonly ReviewComment[] | undefined
  pending?: boolean
}): React.JSX.Element | null {
  if (!comments && !pending) return null
  const hasOpen = comments?.some((c) => !c.resolved) ?? false
  return (
    <>
      {pending ? (
        <div className="pointer-events-none absolute inset-0 bg-primary/15" />
      ) : hasOpen ? (
        <div className="pointer-events-none absolute inset-0 bg-accent" />
      ) : null}
      {comments && comments.length > 0 && (
        <div className="absolute left-0.5 top-1/2 z-10 -translate-y-1/2">
          <CommentMarker comments={comments} />
        </div>
      )}
    </>
  )
}
