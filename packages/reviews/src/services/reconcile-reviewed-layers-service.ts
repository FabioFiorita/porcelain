import type { ReconcileReviewedLayersInput } from '../models/reconcile-reviewed-layers.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { layerStaleness } from '../rules/reviewed-marks.ts';
import { reviewFiles } from '../rules/review-evidence.ts';

export class ReconcileReviewedLayersService {
  private readonly reviews: ReviewStore;
  private readonly reviewedLayers: ReviewedLayerStore;

  constructor(reviews: ReviewStore, reviewedLayers: ReviewedLayerStore) {
    this.reviews = reviews;
    this.reviewedLayers = reviewedLayers;
  }

  execute(input: ReconcileReviewedLayersInput): void {
    const { worktreeId } = input;
    const { stale, fresh } = layerStaleness(
      this.reviewedLayers.list({ worktreeId }),
      this.reviews.read({ worktreeId })?.layers ?? [],
      reviewFiles(input.texts),
    );
    this.reviewedLayers.setStale({ worktreeId, layerIds: stale, stale: true });
    this.reviewedLayers.setStale({ worktreeId, layerIds: fresh, stale: false });
  }
}
