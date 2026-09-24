import type {
  WorktreeStatus,
  WorktreeStatuses,
} from '@porcelain/kernel/models';
import type { AgentReply, CommentSeenMark } from '../models/comment-thread.ts';
import type { Review } from '../models/review.ts';
import type { WorktreeReviewedLayerMark } from '../models/reviewed-mark.ts';

function everyLayerReviewed(
  review: Review,
  marks: readonly WorktreeReviewedLayerMark[],
): boolean {
  return review.layers.every((layer) =>
    marks.some(
      (mark) =>
        mark.worktreeId === review.worktreeId &&
        mark.layerId === layer.id &&
        mark.fingerprint === layer.fingerprint &&
        !mark.stale,
    ),
  );
}

export function worktreeStatuses(
  reviews: readonly Review[],
  marks: readonly WorktreeReviewedLayerMark[],
  replies: readonly AgentReply[],
  seen: readonly CommentSeenMark[],
): WorktreeStatuses {
  const statuses = new Map<string, WorktreeStatus>();
  for (const review of reviews)
    if (review.active && review.layers.length > 0)
      statuses.set(
        review.worktreeId,
        everyLayerReviewed(review, marks) ? 'reviewed' : 'pending',
      );
  const seenThrough = new Map(
    seen.map((mark) => [mark.worktreeId, mark.seenThrough]),
  );
  for (const reply of replies)
    if (
      !reply.resolved &&
      reply.revision > (seenThrough.get(reply.worktreeId) ?? 0)
    )
      statuses.set(reply.worktreeId, 'replied');
  return statuses;
}
