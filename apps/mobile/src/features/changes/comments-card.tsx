import { fileName } from '@porcelain/client-runtime/paths'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { ConfirmDialog, IconAction, PanelLabel } from '@/components/panel-chrome'
import { PANEL_CARD } from '@/components/surface-layout'
import { CommentComposer } from '@/features/comments/comment-composer'
import { useCommentActions, useReviewComments } from '@/features/comments/use-comments'
import type { ReviewComment } from '@/lib/daemon/procedures/review'
import { cn } from '@/lib/utils'

/** "file.ts", "file.ts:12", or "file.ts:12–18" — the shortest thing that locates a comment. */
function anchorLabel(comment: ReviewComment): string {
  const name = fileName(comment.path)
  if (comment.startLine === undefined) return name
  if (comment.endLine !== undefined && comment.endLine !== comment.startLine) {
    return `${name}:${comment.startLine}–${comment.endLine}`
  }
  return `${name}:${comment.startLine}`
}

/**
 * Review comments for the open repo — the channel the agent reads back through the CLI. This
 * is the outbound half of the review loop: what you noticed on the phone becomes agent input.
 */
export function CommentsCard({ active }: { active: boolean }): React.JSX.Element {
  const comments = useReviewComments(active)
  const { clearResolved, remove, setResolved } = useCommentActions()
  const [confirmClear, setConfirmClear] = useState(false)
  const [editing, setEditing] = useState<ReviewComment | null>(null)
  const open = comments.filter((comment) => !comment.resolved).length
  const closed = comments.length - open

  return (
    <View className="gap-2" testID="porcelain-changes-comments">
      <View className="flex-row items-center justify-between gap-1">
        <PanelLabel>{open > 0 ? `Comments · ${open} open` : 'Comments'}</PanelLabel>
        {closed === 0 ? null : (
          <IconAction
            accessibilityLabel="Clear closed comments"
            glyph="eraser"
            testID="porcelain-changes-comments-clear"
            onPress={() => {
              setConfirmClear(true)
            }}
          />
        )}
      </View>

      {comments.length === 0 ? (
        <Text className="text-2xs leading-4 text-muted-foreground">
          Long-press a line in a diff to select it, tap more lines to extend the range, then
          Comment. Long-press a file in the list to comment on the whole file. Your agent reads them
          as review context.
        </Text>
      ) : (
        <View className="gap-1.5">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              onEdit={() => {
                setEditing(comment)
              }}
              onRemove={() => {
                remove(comment.id)
              }}
              onToggleResolved={() => {
                setResolved(comment.id, !comment.resolved)
              }}
            />
          ))}
        </View>
      )}

      <CommentComposer
        anchor={null}
        editing={editing}
        testIDPrefix="porcelain-changes-edit-comment"
        onClose={() => {
          setEditing(null)
        }}
      />

      <ConfirmDialog
        body={`This permanently deletes ${closed} closed ${closed === 1 ? 'comment' : 'comments'}. Open comments are left alone.`}
        confirmLabel="Clear"
        open={confirmClear}
        testID="porcelain-changes-comments-clear-confirm"
        title="Clear closed comments?"
        onCancel={() => {
          setConfirmClear(false)
        }}
        onConfirm={() => {
          setConfirmClear(false)
          clearResolved()
        }}
      />
    </View>
  )
}

function CommentRow({
  comment,
  onEdit,
  onRemove,
  onToggleResolved,
}: {
  comment: ReviewComment
  onEdit: () => void
  onRemove: () => void
  onToggleResolved: () => void
}): React.JSX.Element {
  return (
    <View
      className={cn('gap-1 p-2.5', PANEL_CARD, comment.resolved && 'opacity-60')}
      testID={`porcelain-changes-comment-${comment.id}`}
    >
      <View className="flex-row items-center gap-1">
        <Text className="min-w-0 flex-1 font-mono text-2xs text-muted-foreground" numberOfLines={1}>
          {anchorLabel(comment)}
        </Text>
        <IconAction
          accessibilityLabel="Edit comment"
          glyph="pencil"
          testID={`porcelain-changes-comment-edit-${comment.id}`}
          onPress={onEdit}
        />
        <IconAction
          accessibilityLabel={comment.resolved ? 'Reopen comment' : 'Resolve comment'}
          glyph={comment.resolved ? 'undo' : 'check'}
          testID={`porcelain-changes-comment-resolve-${comment.id}`}
          tone={comment.resolved ? 'muted' : 'success'}
          onPress={onToggleResolved}
        />
        <IconAction
          accessibilityLabel="Delete comment"
          glyph="trash"
          testID={`porcelain-changes-comment-delete-${comment.id}`}
          tone="destructive"
          onPress={onRemove}
        />
      </View>
      <Text className={cn('text-xs leading-5 text-foreground', comment.resolved && 'line-through')}>
        {comment.body}
      </Text>
      {comment.agentReply === undefined ? null : (
        <View className="mt-0.5 gap-0.5 border-l-2 border-border pl-2">
          <PanelLabel>Agent</PanelLabel>
          <Text className="text-xs leading-5 text-muted-foreground">{comment.agentReply.body}</Text>
        </View>
      )}
    </View>
  )
}
