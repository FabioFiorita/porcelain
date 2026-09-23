import type {
  InvalidateReviewedMarksInput,
  InvalidateReviewedMarksResult,
} from '../models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { touchedMarks } from '../rules/reviewed-marks.ts';

export class InvalidateReviewedMarksService {
  private readonly reviewedFileStore: ReviewedFileStore;
  private readonly reviewedLayerStore: ReviewedLayerStore;

  constructor(
    reviewedFileStore: ReviewedFileStore,
    reviewedLayerStore: ReviewedLayerStore,
  ) {
    this.reviewedFileStore = reviewedFileStore;
    this.reviewedLayerStore = reviewedLayerStore;
  }

  execute(input: InvalidateReviewedMarksInput): InvalidateReviewedMarksResult {
    const { worktreeId, paths } = input;
    if (paths?.length === 0) return;
    const files = touchedMarks(
      this.reviewedFileStore.list(worktreeId).map((mark) => mark.path),
      paths,
    );
    if (files.length > 0)
      this.reviewedFileStore.setStale(worktreeId, files, true);
    const layers = this.reviewedLayerStore
      .list(worktreeId)
      .map((mark) => mark.layerId);
    if (layers.length > 0)
      this.reviewedLayerStore.setStale(worktreeId, layers, true);
  }
}
