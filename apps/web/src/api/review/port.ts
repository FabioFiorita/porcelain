import type {
  ChangeDiffs,
  ChangeDiffsRequest,
  ChangeLines,
  ChangeList,
  CommitDiffs,
  CommitFiles,
  Directory,
  FileEdit,
  FileEditResult,
  History,
  PreviewAssets,
  ReviewedMarksResponse,
  ReviewScope,
  SetReviewedBulkRequest,
  SetReviewedBulkResponse,
  SetReviewedRequest,
  Status,
  TextFile,
  WorktreePaths,
} from '../../domain/review';
export type ReviewRequest = ReviewScope & {
  signal: AbortSignal;
};
export type ReviewPort = {
  reviewedLayers: ReturnType<
    typeof import('@porcelain/client/review').createReviewClient
  >['reviewedLayers'];
  review: (
    request: ReviewRequest,
  ) => Promise<import('@porcelain/contracts/review').ReviewResponse | null>;
  asset: (
    request: ReviewRequest & { path: string },
  ) => Promise<import('@porcelain/contracts/files').AssetResponse>;
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
  commit: (
    request: ReviewRequest & { oid: string; parent?: number },
  ) => Promise<CommitFiles>;
  commitDiffs: (
    request: ReviewRequest & {
      oid: string;
      parent?: number;
      paths: string[][];
    },
  ) => Promise<CommitDiffs>;
  directory: (request: ReviewRequest & { path: string }) => Promise<Directory>;
  changes: (request: ReviewRequest) => Promise<{ changes: ChangeList }>;
  history: (
    request: ReviewRequest & { after?: string[]; tip?: string },
  ) => Promise<History>;
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
