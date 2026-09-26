import type {
  ChangeDiffs,
  ChangeDiffsRequest,
  ChangeLines,
  ChangeList,
  ReviewedMarksResponse,
  ReviewResponse,
  ReviewScope,
  SetReviewedBulkRequest,
  SetReviewedBulkResponse,
  SetReviewedRequest,
  Status,
} from '@/features/review/model/review';
import type {
  ListReviewedLayersResponse,
  SetReviewedLayerRequest,
} from '@porcelain/contracts/reviews';
export type ReviewRequest = ReviewScope & {
  signal: AbortSignal;
};
export type ReviewPort = {
  reviewedLayers: {
    list: (request: ReviewRequest) => Promise<ListReviewedLayersResponse>;
    set: (
      request: ReviewRequest & { input: SetReviewedLayerRequest },
    ) => Promise<ListReviewedLayersResponse>;
    remove: (
      request: ReviewRequest & { layerId: string },
    ) => Promise<ListReviewedLayersResponse>;
  };
  review: (request: ReviewRequest) => Promise<ReviewResponse | null>;
  status: (request: ReviewRequest) => Promise<Status>;
  diffs: (
    request: ReviewRequest & { input: ChangeDiffsRequest },
  ) => Promise<ChangeDiffs>;
  lines: (
    request: ReviewRequest & {
      path: string;
      from: number;
      to: number;
      at: 'head' | 'worktree';
    },
  ) => Promise<ChangeLines>;
  changes: (request: ReviewRequest) => Promise<{ changes: ChangeList }>;
  reviewed: {
    list: (request: ReviewRequest) => Promise<ReviewedMarksResponse>;
    set: (
      request: ReviewRequest & { input: SetReviewedRequest },
    ) => Promise<ReviewedMarksResponse>;
    setAll: (
      request: ReviewRequest & { input: SetReviewedBulkRequest },
    ) => Promise<SetReviewedBulkResponse>;
    remove: (
      request: ReviewRequest & { path: string },
    ) => Promise<ReviewedMarksResponse>;
  };
};
