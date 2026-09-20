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
  /**
   * Where the walk had got to: the commits whose children have all been shown.
   * Absent asks for the newest commits.
   */
  after?: string[];
  /** The commit the list started at, to notice a history rewritten since. */
  tip?: string;
}
export interface CommitPage {
  /**
   * What HEAD was when the page was read. Only a page read from the top has
   * one: a continuation is anchored to a commit, not to the branch, and never
   * needed to look.
   */
  snapshot: HeadSnapshot | null;
  commits: CommitSummary[];
  /** The frontier to continue from. Null when there is nothing after this. */
  nextAfter: string[] | null;
  /** The commit this list started at, carried back on every continuation. */
  tip: string | null;
  boundary: 'shallow' | 'wide' | null;
  /**
   * The requested commit had left the branch, so this is the top of the
   * history that exists now rather than the continuation that was asked for.
   */
  restarted: boolean;
}
/** What the guard establishes, per request, without spawning anything. */
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
  /** Both directories come from the registry, which reads them from disk. */
  commonDirectory: string;
  administrativeDirectory: string;
  repositoryIdentity: string;
  metadataIdentity: string;
  scope: string;
}
