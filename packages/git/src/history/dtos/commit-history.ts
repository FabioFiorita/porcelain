type HeadSnapshot = {
  tipOid: string | null;
  head:
    | { kind: 'attached'; ref: string }
    | { kind: 'detached' }
    | { kind: 'unborn'; ref: string };
};
type CommitRef =
  | { kind: 'local-branch' | 'remote-branch' | 'tag'; name: string }
  | { kind: 'head'; name: 'HEAD' };

export type CommitSummary = {
  oid: string;
  parentOids: string[];
  author: { name: string; timestamp: string };
  subject: string;
  subjectTruncated: boolean;
  body: string | null;
  bodyTruncated: boolean;
  refs: CommitRef[];
};
export type CommitPageRequest = {
  limit?: number;
  after?: readonly string[];
  tip?: string;
};
export type CommitPage = {
  snapshot: HeadSnapshot | null;
  commits: CommitSummary[];
  nextAfter: string[] | null;
  tip: string | null;
  boundary: 'shallow' | 'wide' | null;
  restarted: boolean;
};
export type HistorySnapshot = {
  graph: string;
  shallowOids: readonly string[];
};
export type CommitFilesRequest = {
  oid: string;
  parent?: number;
};
export type CommitFile = {
  oldPath: string | null;
  newPath: string | null;
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'type-changed';
  oldMode: string;
  newMode: string;
};
export type CommitFiles = {
  commit: CommitSummary;
  comparison:
    | { kind: 'parent'; parentNumber: number; baseOid: string }
    | { kind: 'empty-tree' };
  files: CommitFile[];
};
export type CommitDiffsRequest = {
  oid: string;
  parent?: number;
  paths: readonly (readonly string[])[];
};
export type HistoryCheckout = {
  path: string;
  commonDirectory: string;
  administrativeDirectory: string;
  repositoryIdentity: string;
  metadataIdentity: string;
};
export type FileCommitsRequest = {
  path: string;
  limit?: number;
  after?: { readonly tip: string; readonly offset: number };
};
export type FileCommit = {
  commit: CommitSummary;
  path: string;
  previousPath: string | null;
  status: CommitFile['status'];
};
export type FileCommits = {
  commits: FileCommit[];
  nextAfter: { readonly tip: string; readonly offset: number } | null;
  tip: string | null;
  boundary: 'shallow' | null;
  restarted: boolean;
};

export type HistoryRepository = { kind: 'repository'; path: string };
