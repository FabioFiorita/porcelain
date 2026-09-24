import type {
  ReconcileReviewedLayersInput,
  ReconcileReviewedLayersResult,
} from '../models/reconcile-reviewed-layers.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import {
  currentLayerFingerprints,
  markStaleness,
} from '../rules/reviewed-marks.ts';

export class ReconcileReviewedLayersService {
  private readonly reviews: ReviewStore;
  private readonly reviewedLayers: ReviewedLayerStore;

  constructor(reviews: ReviewStore, reviewedLayers: ReviewedLayerStore) {
    this.reviews = reviews;
    this.reviewedLayers = reviewedLayers;
  }

  execute(input: ReconcileReviewedLayersInput): ReconcileReviewedLayersResult {
    const { worktreeId } = input;
    const { stale, fresh } = markStaleness(
      this.reviewedLayers.list({ worktreeId }),
      (mark) => mark.layerId,
      currentLayerFingerprints(
        this.reviews.read({ worktreeId })?.layers ?? [],
        input.texts,
      ),
    );
    this.reviewedLayers.setStale({ worktreeId, layerIds: stale, stale: true });
    this.reviewedLayers.setStale({ worktreeId, layerIds: fresh, stale: false });
    return { changed: stale.length > 0 || fresh.length > 0 };
  }
}
