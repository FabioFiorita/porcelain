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
 * Host-row background class for a commented or pending line. Apply on the same
 * element that holds the line text — never as an absolute overlay.
 *
 * Why: after the opaque redesign, `bg-accent` is fully opaque. An
 * `absolute inset-0` tint paints *above* in-flow code (positioned descendants
 * stack after non-positioned content), blanking the line while the z-10 gutter
 * glyph still shows — the "gray block, code gone" bug. Row background keeps
 * the tint under the text, matching `EditorSource`.
 */
export function commentRowClass(
  comments: readonly ReviewComment[] | undefined,
  pending = false,
): string | undefined {
  if (pending) return 'bg-primary/15'
  if (comments?.some((c) => !c.resolved)) return 'bg-accent'
  return undefined
}

/**
 * Gutter glyph for a code/diff line's comments. The host row must be `relative`
 * and should also take `commentRowClass(comments, pending)` so open/pending
 * lines tint without covering the text. A line with only resolved comments gets
 * the dimmed glyph and no tint.
 */
export function LineDecorations({
  comments,
}: {
  comments: readonly ReviewComment[] | undefined
}): React.JSX.Element | null {
  if (!comments || comments.length === 0) return null
  return (
    <div className="absolute left-0.5 top-1/2 z-10 -translate-y-1/2">
      <CommentMarker comments={comments} />
    </div>
  )
}
