export type HeadSnapshot = {
  tipOid: string | null;
  head:
    | { kind: 'attached'; ref: string }
    | { kind: 'detached' }
    | { kind: 'unborn'; ref: string };
};
export interface CommitSummary {
  oid: string;
  parentOids: string[];
  author: { name: string; timestamp: string };
  subject: string;
  subjectTruncated: boolean;
  body: string | null;
  bodyTruncated: boolean;
  refs: string[];
}
export interface CommitPageRequest {
  limit?: number;
  after?: string[];
  tip?: string;
}
export interface CommitPage {
  snapshot: HeadSnapshot | null;
  commits: CommitSummary[];
  nextAfter: string[] | null;
  tip: string | null;
  boundary: 'shallow' | 'wide' | null;
  restarted: boolean;
}
export interface HistorySnapshot {
  graph: string;
  shallow: boolean;
}
export interface CommitFilesRequest {
  oid: string;
  parent?: number;
}
export interface CommitFile {
  oldPath: string | null;
  newPath: string | null;
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'type-changed';
  oldMode: string;
  newMode: string;
}
export interface CommitFiles {
  commit: CommitSummary;
  comparison:
    | { kind: 'parent'; parentNumber: number; baseOid: string }
    | { kind: 'empty-tree' };
  files: CommitFile[];
}
export interface CommitDiffsRequest {
  oid: string;
  parent?: number;
  paths: string[];
}
export interface HistoryCheckout {
  path: string;
  commonDirectory: string;
  administrativeDirectory: string;
  repositoryIdentity: string;
  metadataIdentity: string;
}
