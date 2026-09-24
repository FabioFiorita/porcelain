import type {
  ReadReviewBadgesInput,
  ReadReviewBadgesResult,
} from '../models/read-review-badges.ts';
import type { CommentSeenStore } from '../ports/comment-seen-store.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { worktreeStatuses } from '../rules/worktree-statuses.ts';

export class ReadReviewBadgesService {
  private readonly reviews: ReviewStore;
  private readonly reviewedLayers: ReviewedLayerStore;
  private readonly comments: CommentStore;
  private readonly commentSeen: CommentSeenStore;

  constructor(
    reviews: ReviewStore,
    reviewedLayers: ReviewedLayerStore,
    comments: CommentStore,
    commentSeen: CommentSeenStore,
  ) {
    this.reviews = reviews;
    this.reviewedLayers = reviewedLayers;
    this.comments = comments;
    this.commentSeen = commentSeen;
  }

  execute(input: ReadReviewBadgesInput): ReadReviewBadgesResult {
    const { worktreeIds } = input;
    return {
      statuses: worktreeStatuses(
        this.reviews.byWorktrees({ worktreeIds }),
        this.reviewedLayers.byWorktrees({ worktreeIds }),
        this.comments.agentRepliesByWorktrees({ worktreeIds }),
        this.commentSeen.seenByWorktrees({ worktreeIds }),
      ),
    };
  }
}
