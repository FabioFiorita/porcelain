import type { RefreshReviewActivityInput } from '../models/refresh-review-activity.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import { resolveLayer, reviewIsActive } from '../rules/resolve-review.ts';
import { reviewDiagnostics } from '../rules/review-diagnostics.ts';
import {
  reviewChanges,
  reviewFiles,
  reviewPatches,
} from '../rules/review-evidence.ts';

export class RefreshReviewActivityService {
  private readonly reviews: ReviewStore;

  constructor(reviews: ReviewStore) {
    this.reviews = reviews;
  }

  execute(input: RefreshReviewActivityInput): void {
    const { review } = input;
    const files = reviewFiles(input.texts);
    const diagnostics = reviewDiagnostics(
      reviewChanges(input.changes),
      files,
      reviewPatches(input.diffs),
    );
    const active = reviewIsActive(
      review.layers.map((layer) =>
        resolveLayer(layer, files, diagnostics.changed),
      ),
    );
    if (active === review.active) return;
    this.reviews.setActive({
      worktreeId: review.worktreeId,
      revision: review.revision,
      active,
    });
  }
}
