import type {
  Artifact,
  ArtifactContent,
  CommitChanges,
  CommitReviewLayers,
  Diff,
  DiffRequest,
  Directory,
  EvidenceResponse,
  FileEdit,
  FileEditResult,
  FileTree,
  History,
  Layers,
  ReviewedMarksResponse,
  ReviewScope,
  ReviewSummary,
  SetReviewedRequest,
  Status,
  TextFile,
} from '../../domain/review';
export type ReviewRequest = ReviewScope & {
  token: string;
  signal: AbortSignal;
};
export type ReviewPort = {
  asset: (
    request: ReviewRequest & { path: string },
  ) => Promise<import('@porcelain/contracts/files').AssetResponse>;
  commitLayers: (
    request: ReviewRequest & { oid: string },
  ) => Promise<CommitReviewLayers | null>;
  summary: (request: ReviewRequest) => Promise<ReviewSummary>;
  fileTree: (request: ReviewRequest) => Promise<FileTree>;
  editFile: (
    request: ReviewRequest & { input: FileEdit },
  ) => Promise<FileEditResult>;
  text: (request: ReviewRequest & { path: string }) => Promise<TextFile>;
  diff: (request: ReviewRequest & { input: DiffRequest }) => Promise<Diff>;
  commit: (
    request: ReviewRequest & { oid: string; parent?: number },
  ) => Promise<CommitChanges>;
  directory: (request: ReviewRequest & { path: string }) => Promise<Directory>;
  changes: (
    request: ReviewRequest,
  ) => Promise<{ status: Status; layers: Layers }>;
  history: (request: ReviewRequest & { cursor?: string }) => Promise<History>;
  artifacts: (request: ReviewRequest) => Promise<Artifact[]>;
  evidence: (request: ReviewRequest) => Promise<EvidenceResponse>;
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
