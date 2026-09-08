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
}
export interface CommitPageRequest {
  limit?: number;
  cursor?: string;
}
export interface CommitPage {
  snapshot: HeadSnapshot;
  commits: CommitSummary[];
  nextCursor: string | null;
  boundary: 'shallow' | null;
}
export interface CommitChangesRequest {
  oid: string;
  parent?: number;
}
export interface CommitChange {
  oldPath: string | null;
  newPath: string | null;
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'type-changed';
  oldMode: string;
  newMode: string;
  patch:
    | { kind: 'text'; text: string }
    | { kind: 'binary' }
    | { kind: 'submodule'; text: string };
}
export interface CommitChanges {
  commitOid: string;
  parentOids: string[];
  comparison:
    | { kind: 'parent'; parentNumber: number; baseOid: string }
    | { kind: 'empty-tree' };
  changes: CommitChange[];
}
export interface HistoryCheckout {
  path: string;
  repositoryIdentity: string;
  metadataIdentity: string;
  scope: string;
}
