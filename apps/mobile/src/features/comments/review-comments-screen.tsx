import type { ReviewComment } from '@porcelain/contracts/review'
import { runUserAction } from '@porcelain/shared/background'
import { Stack, useIsFocused } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'

import { ConfirmDialog, EmptyNote, IconAction, PanelLabel } from '@/components/panel-chrome'
import { PANEL_CARD } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { useHubRepoPath } from '@/features/projects'
import { cn } from '@/lib/utils'

import { CommentComposerSheet } from './comment-composer-sheet'
import { useCommentActions, useReviewComments } from './comment-data'
import {
  type CommentThread,
  commentCounts,
  commentThreads,
  describeAnchor,
  describeCommentCounts,
} from './comment-threads'

/**
 * The human's half of the Review: what was said about this checkout, and the two things the
 * daemon lets a human do about it.
 *
 * Reading, replying and resolving — and nothing else. There is no reply procedure on the wire,
 * so a reply is another comment on the same anchor; `agentReply` is read-only here because the
 * agent writes it. Starting a comment on a *new* anchor is not offered: the anchor is a file
 * and a line range, and the surface that knows those is Files, not this one.
 */
export function ReviewCommentsScreen(): React.JSX.Element {
  const focused = useIsFocused()
  const repoPath = useHubRepoPath()
  const comments = useReviewComments(focused)
  const actions = useCommentActions()
  const [replyTo, setReplyTo] = useState<CommentThread | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const threads = commentThreads(comments)
  const counts = commentCounts(comments)

  const report = (label: string) => (error: unknown) => {
    Alert.alert(label, error instanceof Error ? error.message : String(error))
  }

  return (
    <View className="flex-1 bg-background" testID="porcelain-review-comments">
      <Stack.Screen
        options={{
          // Hygiene only, and only when there is something to clear — a header button that
          // opens a menu of disabled items is worse than no button.
          headerRight: () =>
            counts.resolved === 0 ? null : (
              <IconAction
                accessibilityLabel="Clear resolved comments"
                glyph="eraser"
                testID="porcelain-review-comments-clear-resolved"
                onPress={() => {
                  setConfirmClear(true)
                }}
              />
            ),
          title: 'Review comments',
        }}
      />
      {repoPath === null ? (
        <EmptyNote
          body="Pick a worktree from the list first — comments belong to a checkout."
          testID="porcelain-review-comments-no-worktree"
          title="No worktree selected"
        />
      ) : threads.length === 0 ? (
        <EmptyNote
          body="Comments left on this checkout's files show up here, with the agent's answers."
          testID="porcelain-review-comments-empty"
          title="No comments yet"
        />
      ) : (
        <SurfaceScroll gap={3} paddingTop={8}>
          <PanelLabel>{describeCommentCounts(comments)}</PanelLabel>
          {threads.map((thread) => (
            <ThreadCard
              key={thread.key}
              busy={actions.isPending}
              thread={thread}
              onDelete={(id) => {
                runUserAction(() => actions.remove(id), report('Could not delete the comment'))
              }}
              onReply={() => {
                setReplyTo(thread)
              }}
              onSetResolved={(id, resolved) => {
                runUserAction(
                  () => actions.setResolved(id, resolved),
                  report(resolved ? 'Could not resolve' : 'Could not reopen'),
                )
              }}
            />
          ))}
        </SurfaceScroll>
      )}

      <ConfirmDialog
        body={`Removes ${counts.resolved} resolved ${
          counts.resolved === 1 ? 'comment' : 'comments'
        } from this review. It cannot be undone.`}
        confirmLabel="Clear"
        open={confirmClear}
        title="Clear resolved comments?"
        onCancel={() => {
          setConfirmClear(false)
        }}
        onConfirm={() => {
          setConfirmClear(false)
          runUserAction(() => actions.clearResolved(), report('Could not clear resolved comments'))
        }}
      />
      <CommentComposerSheet
        anchorLabel={replyTo === null ? '' : describeAnchor(replyTo.range)}
        open={replyTo !== null}
        pending={actions.isPending}
        subject={replyTo?.path ?? ''}
        onClose={() => {
          setReplyTo(null)
        }}
        onSubmit={(body) => {
          const target = replyTo
          if (target === null) return
          setReplyTo(null)
          runUserAction(
            () =>
              actions.add({
                body,
                path: target.path,
                ...(target.range === null
                  ? {}
                  : { endLine: target.range.endLine, startLine: target.range.startLine }),
              }),
            report('Could not add the comment'),
          )
        }}
      />
    </View>
  )
}

/**
 * A thread's identity as something a test runner can type. The grouping key joins on NUL so no
 * path can forge one; a NUL inside a `testID` is not addressable, so it becomes a dash here.
 */
function threadTestId(thread: CommentThread): string {
  return `porcelain-review-thread-${thread.key.replace('\u0000', '-')}`
}

/** One anchor's exchange: what was said, what the agent answered, and what is still open. */
function ThreadCard({
  busy,
  onDelete,
  onReply,
  onSetResolved,
  thread,
}: {
  busy: boolean
  onDelete: (id: string) => void
  onReply: () => void
  onSetResolved: (id: string, resolved: boolean) => void
  thread: CommentThread
}): React.JSX.Element {
  return (
    <View className={cn(PANEL_CARD, 'gap-3 p-3')} testID={threadTestId(thread)}>
      <View className="gap-0.5">
        <Text className="text-xs font-semibold text-foreground">
          {describeAnchor(thread.range)}
        </Text>
        {/* Head-truncated: the tail of a path is what identifies the file. */}
        <Text
          className="font-mono text-3xs text-muted-foreground"
          ellipsizeMode="head"
          numberOfLines={1}
        >
          {thread.path}
        </Text>
      </View>
      {thread.comments.map((comment) => (
        <CommentCard
          key={comment.id}
          busy={busy}
          comment={comment}
          onDelete={() => {
            onDelete(comment.id)
          }}
          onSetResolved={() => {
            onSetResolved(comment.id, !comment.resolved)
          }}
        />
      ))}
      <Pressable
        accessibilityLabel={`Reply on ${describeAnchor(thread.range)}`}
        accessibilityRole="button"
        className="h-9 flex-row items-center justify-center rounded-lg border border-border bg-secondary active:opacity-80"
        testID={`${threadTestId(thread)}-reply`}
        onPress={onReply}
      >
        <Text className="text-sm font-medium text-secondary-foreground">Reply</Text>
      </Pressable>
    </View>
  )
}

function CommentCard({
  busy,
  comment,
  onDelete,
  onSetResolved,
}: {
  busy: boolean
  comment: ReviewComment
  onDelete: () => void
  onSetResolved: () => void
}): React.JSX.Element {
  return (
    <View
      className={cn('gap-1', comment.resolved && 'opacity-55')}
      testID={`porcelain-review-comment-${comment.id}`}
    >
      <View className="flex-row items-start gap-1">
        <Text
          className={cn(
            'min-w-0 flex-1 text-sm leading-5 text-foreground',
            comment.resolved && 'text-muted-foreground line-through',
          )}
        >
          {comment.body}
        </Text>
        <IconAction
          accessibilityLabel={comment.resolved ? 'Reopen comment' : 'Resolve comment'}
          disabled={busy}
          glyph={comment.resolved ? 'undo' : 'check'}
          testID={`porcelain-review-comment-resolve-${comment.id}`}
          tone={comment.resolved ? 'muted' : 'success'}
          onPress={onSetResolved}
        />
        <IconAction
          accessibilityLabel="Delete comment"
          disabled={busy}
          glyph="trash"
          testID={`porcelain-review-comment-delete-${comment.id}`}
          tone="destructive"
          onPress={onDelete}
        />
      </View>
      {comment.agentReply === undefined ? null : (
        <View
          className="ml-1 gap-0.5 border-l-2 border-border pl-2"
          testID={`porcelain-review-comment-agent-${comment.id}`}
        >
          <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
            Agent
          </Text>
          <Text className="text-sm leading-5 text-muted-foreground">{comment.agentReply.body}</Text>
        </View>
      )}
    </View>
  )
}
