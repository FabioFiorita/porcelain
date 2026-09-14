import type {
  Artifact,
  ArtifactContent,
  CommitChanges,
  Diff,
  DiffRequest,
  Directory,
  EvidenceResponse,
  History,
  Layers,
  ReviewedMarksResponse,
  ReviewScope,
  SetReviewedRequest,
  Status,
  TextFile,
} from '../../domain/review';
export type ReviewRequest = ReviewScope & {
  token: string;
  signal: AbortSignal;
};
export type ReviewPort = {
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
