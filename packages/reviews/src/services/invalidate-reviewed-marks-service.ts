import type { InvalidateReviewedMarksInput } from '../models/invalidate-reviewed-marks.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { touchedMarks } from '../rules/reviewed-marks.ts';

export class InvalidateReviewedMarksService {
  private readonly reviewedFiles: ReviewedFileStore;
  private readonly reviewedLayers: ReviewedLayerStore;

  constructor(
    reviewedFiles: ReviewedFileStore,
    reviewedLayers: ReviewedLayerStore,
  ) {
    this.reviewedFiles = reviewedFiles;
    this.reviewedLayers = reviewedLayers;
  }

  execute(input: InvalidateReviewedMarksInput): void {
    const { worktreeId, paths } = input;
    if (paths?.length === 0) return;
    this.reviewedFiles.setStale({
      worktreeId,
      paths: touchedMarks(
        this.reviewedFiles.list({ worktreeId }).map((mark) => mark.path),
        paths,
      ),
      stale: true,
    });
    this.reviewedLayers.setStale({
      worktreeId,
      layerIds: this.reviewedLayers
        .list({ worktreeId })
        .map((mark) => mark.layerId),
      stale: true,
    });
  }
}
