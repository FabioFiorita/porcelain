import type { ReviewComment } from '@porcelain/contracts/review'

import { describeRange, type LineRange } from './line-range'

/**
 * Review comments, grouped the way a phone has to read them.
 *
 * The wire has no thread: a comment is a body on a `path` with an optional line range, and the
 * only nested shape is the single `agentReply` the daemon writes when the agent answers. There
 * is no reply procedure at all, so what a human calls "replying" is another comment on the
 * same anchor — which means the anchor IS the thread, and grouping by it is what turns a flat
 * list into the conversation the desk clients show inline beside the code.
 */

/** One anchor's comments, oldest first — a reply reads after the thing it answers. */
export type CommentThread = {
  /** Stable across refetches: the anchor, not any comment's id. */
  readonly key: string
  readonly path: string
  /** Null for a comment left on the whole file. */
  readonly range: LineRange | null
  readonly comments: readonly ReviewComment[]
}

/** The range a comment covers, or null when it is anchored to the whole file. */
export function commentRange(comment: ReviewComment): LineRange | null {
  if (comment.startLine === undefined) return null
  return { endLine: comment.endLine ?? comment.startLine, startLine: comment.startLine }
}

/**
 * The anchor two comments must share to belong to the same thread.
 *
 * Joined on NUL because a repo-relative path may contain a space or a dash, and a separator
 * that can appear inside the path would let two different anchors collide on one key.
 */
export function commentAnchorKey(comment: ReviewComment): string {
  const range = commentRange(comment)
  return range === null
    ? `${comment.path}\u0000file`
    : `${comment.path}\u0000${range.startLine}-${range.endLine}`
}

/** "File comment" / "Line 12" / "Lines 12–18" — the web marker's labels, verbatim. */
export function describeAnchor(range: LineRange | null): string {
  return range === null ? 'File comment' : describeRange(range)
}

/**
 * Group a daemon comment list into threads.
 *
 * The daemon lists newest first. Comments inside a thread are reversed back to oldest first so
 * the exchange reads downward, while the threads themselves keep the daemon's order — a thread
 * appears where its newest comment did, so answering one moves it to the top.
 */
export function commentThreads(comments: readonly ReviewComment[]): readonly CommentThread[] {
  const order: string[] = []
  const grouped = new Map<string, ReviewComment[]>()
  for (const comment of comments) {
    const key = commentAnchorKey(comment)
    const existing = grouped.get(key)
    if (existing === undefined) {
      order.push(key)
      grouped.set(key, [comment])
    } else {
      existing.push(comment)
    }
  }
  return order.map((key) => {
    const members = grouped.get(key) ?? []
    const first = members[0]
    return {
      comments: [...members].reverse(),
      key,
      path: first?.path ?? '',
      range: first === undefined ? null : commentRange(first),
    }
  })
}

export type CommentCounts = { readonly open: number; readonly resolved: number }

/** How much of the review is still owed an answer. */
export function commentCounts(comments: readonly ReviewComment[]): CommentCounts {
  const resolved = comments.filter((comment) => comment.resolved).length
  return { open: comments.length - resolved, resolved }
}

/**
 * The line the surface shows. Same sentence the web Changes header uses, so the two clients
 * describe one review the same way; the empty case says so instead of reading "0 open".
 */
export function describeCommentCounts(comments: readonly ReviewComment[]): string {
  if (comments.length === 0) return 'No comments yet'
  const { open, resolved } = commentCounts(comments)
  return `${open} open · ${resolved} resolved`
}
