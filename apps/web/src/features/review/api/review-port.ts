import type {
  ChangeDiffs,
  ChangeDiffsRequest,
  ChangeLines,
  ChangeList,
  Directory,
  FileEdit,
  FileEditResult,
  PreviewAssets,
  ReviewedMarksResponse,
  ReviewResponse,
  ReviewScope,
  SetReviewedBulkRequest,
  SetReviewedBulkResponse,
  SetReviewedRequest,
  Status,
  TextFile,
  WorktreePaths,
} from '@/features/review/model/review';
import type {
  ListReviewedLayersResponse,
  SetReviewedLayerRequest,
} from '@porcelain/contracts/reviews';
import type { ReadFileAssetResponse } from '@porcelain/contracts/files';
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
  asset: (
    request: ReviewRequest & { path: string },
  ) => Promise<ReadFileAssetResponse>;
  previewAssets: (
    request: ReviewRequest & { document: string; paths: string[] },
  ) => Promise<PreviewAssets>;
  worktreePaths: (request: ReviewRequest) => Promise<WorktreePaths>;
  editFile: (
    request: ReviewRequest & { input: FileEdit },
  ) => Promise<FileEditResult>;
  text: (request: ReviewRequest & { path: string }) => Promise<TextFile>;
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
  directory: (request: ReviewRequest & { path: string }) => Promise<Directory>;
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
