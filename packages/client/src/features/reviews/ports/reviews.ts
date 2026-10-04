import type {
  ReadPublishedReviewResponse,
  ReadProofFileResponse,
  ListReviewedFilesResponse,
  SetReviewedFilesRequest,
  SetReviewedFilesResponse,
  SetReviewedFileRequest,
  ListReviewedLayersResponse,
  SetReviewedLayerRequest,
} from '@porcelain/contracts/reviews';
type ReviewResponse = NonNullable<ReadPublishedReviewResponse['review']>;
type ProofFile = ReadProofFileResponse;
type ReviewedMarksResponse = ListReviewedFilesResponse;
type SetReviewedBulkRequest = SetReviewedFilesRequest;
type SetReviewedBulkResponse = SetReviewedFilesResponse;
type MarkReviewedInput = Pick<SetReviewedFileRequest, 'path' | 'fingerprint'>;
type ReviewRequest = {
  worktreeId: string;
  projectId?: string;
  signal: AbortSignal;
};
export type ReviewRange =
  | { kind: 'worktree' }
  | { kind: 'branch'; base: string; branch: string | undefined };
type ReviewedRequest = ReviewRequest & { range: ReviewRange };
export type ReviewsPort = {
  review: (request: ReviewRequest) => Promise<ReviewResponse | null>;
  proofFile: (
    request: ReviewRequest & { proofId: string },
  ) => Promise<ProofFile>;
  reviewed: {
    list: (
      request: ReviewRequest & {
        range:
          | { kind: 'worktree' }
          | { kind: 'branch'; branch: string | undefined };
      },
    ) => Promise<ReviewedMarksResponse>;
    set: (
      request: ReviewedRequest & { input: MarkReviewedInput },
    ) => Promise<ReviewedMarksResponse>;
    setAll: (
      request: ReviewedRequest & {
        input: Pick<SetReviewedBulkRequest, 'files'>;
      },
    ) => Promise<SetReviewedBulkResponse>;
    remove: (
      request: ReviewedRequest & { path: string },
    ) => Promise<ReviewedMarksResponse>;
    removeAll: (
      request: ReviewedRequest & { paths: readonly string[] },
    ) => Promise<ReviewedMarksResponse>;
  };
  reviewedLayers: {
    list: (request: ReviewRequest) => Promise<ListReviewedLayersResponse>;
    set: (
      request: ReviewRequest & { input: SetReviewedLayerRequest },
    ) => Promise<ListReviewedLayersResponse>;
    remove: (
      request: ReviewRequest & { layerId: string },
    ) => Promise<ListReviewedLayersResponse>;
  };
};

export type ReviewClock = { now: () => string };
