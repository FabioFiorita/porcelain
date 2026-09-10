import type {
  Artifact,
  CommitChanges,
  Diff,
  DiffRequest,
  Directory,
  History,
  Layers,
  ReviewScope,
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
  commit: (request: ReviewRequest & { oid: string }) => Promise<CommitChanges>;
  directory: (request: ReviewRequest & { path: string }) => Promise<Directory>;
  changes: (
    request: ReviewRequest,
  ) => Promise<{ status: Status; layers: Layers }>;
  history: (request: ReviewRequest & { cursor?: string }) => Promise<History>;
  artifacts: (request: ReviewRequest) => Promise<Artifact[]>;
};
