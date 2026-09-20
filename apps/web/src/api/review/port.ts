import type {
  Artifact,
  ArtifactContent,
  ChangeDiffs,
  ChangeDiffsRequest,
  ChangeLines,
  ChangeList,
  CommitChanges,
  CommitReviewLayers,
  Directory,
  FileEdit,
  FileEditResult,
  FileTree,
  History,
  Layers,
  ReviewedMarksResponse,
  ReviewScope,
  SetReviewedRequest,
  Status,
  TextFile,
} from '../../domain/review';
export type ReviewRequest = ReviewScope & {
  signal: AbortSignal;
};
export type ReviewPort = {
  asset: (
    request: ReviewRequest & { path: string },
  ) => Promise<import('@porcelain/contracts/files').AssetResponse>;
  commitLayers: (
    request: ReviewRequest & { oid: string },
  ) => Promise<CommitReviewLayers | null>;
  fileTree: (request: ReviewRequest) => Promise<FileTree>;
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
  ) => Promise<CommitChanges>;
  directory: (request: ReviewRequest & { path: string }) => Promise<Directory>;
  changes: (
    request: ReviewRequest,
  ) => Promise<{ changes: ChangeList; layers: Layers }>;
  history: (request: ReviewRequest & { cursor?: string }) => Promise<History>;
  artifacts: (request: ReviewRequest) => Promise<Artifact[]>;
  reviewed: {
    list: (request: ReviewRequest) => Promise<ReviewedMarksResponse>;
    set: (
      request: ReviewRequest & { input: SetReviewedRequest },
    ) => Promise<ReviewedMarksResponse>;
    remove: (
      request: ReviewRequest & { path: string },
    ) => Promise<ReviewedMarksResponse>;
  };
  artifact: (
    request: ReviewRequest & { artifactId: string },
  ) => Promise<ArtifactContent>;
};
