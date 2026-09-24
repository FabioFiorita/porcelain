import type {
  ListReviewEvidenceInput,
  ListReviewEvidenceResult,
} from '../models/list-review-evidence.ts';
import { reviewPaths, trackedComparisons } from '../rules/review-evidence.ts';

export class ListReviewEvidenceService {
  execute(input: ListReviewEvidenceInput): ListReviewEvidenceResult {
    return {
      paths: reviewPaths(input.layers, input.changes),
      comparisons: trackedComparisons(input.changes),
    };
  }
}
