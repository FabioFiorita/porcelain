import type { ReviewBadge, ReviewBadges } from '@porcelain/kernel/models';
import type { AgentReply, CommentSeenMark } from '../models/comment-thread.ts';
import type { Review } from '../models/review.ts';
import type { WorktreeReviewedLayerMark } from '../models/reviewed-mark.ts';

function everyLayerReviewed(
  review: Review,
  marks: readonly WorktreeReviewedLayerMark[],
): boolean {
  return review.layers.every((layer) => {
    return marks.some(
      (mark) =>
        mark.worktreeId === review.worktreeId &&
        mark.layerId === layer.id &&
        mark.fingerprint === layer.fingerprint,
    );
  });
}

export function worktreeStatuses(
  reviews: readonly Review[],
  marks: readonly WorktreeReviewedLayerMark[],
  replies: readonly AgentReply[],
  seen: readonly CommentSeenMark[],
): ReviewBadges {
  const statuses = new Map<string, ReviewBadge>();
  for (const review of reviews)
    if (review.layers.length > 0)
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
