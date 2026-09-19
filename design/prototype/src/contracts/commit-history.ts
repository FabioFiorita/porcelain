/**
 * Mirror of packages/contracts/src/commit-history.ts and commit-changes.ts, with the
 * section 8 changes. A page of commits is one `git log`. The next page is "commits
 * before X" (the last commit shown), like GitHub: stable when new commits arrive, no
 * signed cursor, survives restarts. If X is no longer in the branch (rebase, reset)
 * the server answers `HISTORY_REWRITTEN` and the client restarts from the top.
 * A commit opens with its file list; each diff is its own read.
 */

export type CommitSummary = {
  oid: string;
  parentOids: string[];
  author: { name: string; timestamp: string };
  subject: string;
  subjectTruncated: boolean;
  /** PROPOSED: the rest of the commit message. */
  body?: string;
  /** PROPOSED: branch and tag names pointing at this commit, for the graph. */
  refs?: string[];
};

/** GET /worktrees/:worktreeId/history?before=<oid>&limit=50 */
export type CommitPageResponse = {
  head:
    | { kind: 'attached'; ref: string }
    | { kind: 'detached' }
    | { kind: 'unborn'; ref: string };
  commits: CommitSummary[];
  /** PROPOSED: replaces `nextCursor`; ask for commits before the last one to continue. */
  hasMore: boolean;
  boundary: 'shallow' | null;
};

/** PROPOSED: GET /projects/:projectId/commits/:oid/files?parent= */
export type CommitFilesResponse = {
  commitOid: string;
  /** PROPOSED: subject, body, author and refs, so a commit opened from anywhere has its header. */
  commit: CommitSummary;
  parentOids: string[];
  comparison:
    | { kind: 'parent'; parentNumber: number; baseOid: string }
    | { kind: 'empty-tree' };
  files: {
    oldPath: string | null;
    newPath: string | null;
    status: 'added' | 'deleted' | 'modified' | 'renamed' | 'type-changed';
    oldMode: string;
    newMode: string;
  }[];
};

/** PROPOSED: GET /projects/:projectId/commits/:oid/diff?path=&parent= (one Git call). */
export type CommitDiffResponse = {
  commitOid: string;
  path: string;
  patch:
    | { kind: 'text'; text: string }
    | { kind: 'binary' }
    | { kind: 'submodule'; text: string };
};
