import type {
  InvalidateReviewedMarksInput,
  InvalidateReviewedMarksResult,
} from '../models/invalidate-reviewed-marks.ts';
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

  execute(input: InvalidateReviewedMarksInput): InvalidateReviewedMarksResult {
    const { worktreeId, paths } = input;
    if (paths?.length === 0) return { changed: false };
    const files = touchedMarks(
      this.reviewedFiles
        .list({ worktreeId })
        .filter((mark) => !mark.stale)
        .map((mark) => mark.path),
      paths,
    );
    const layerIds = this.reviewedLayers
      .list({ worktreeId })
      .filter((mark) => !mark.stale)
      .map((mark) => mark.layerId);
    this.reviewedFiles.setStale({ worktreeId, paths: files, stale: true });
    this.reviewedLayers.setStale({ worktreeId, layerIds, stale: true });
    return { changed: files.length > 0 || layerIds.length > 0 };
  }
}
