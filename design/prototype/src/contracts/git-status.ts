/**
 * Mirror of packages/contracts/src/git-status.ts and git-diff.ts, with the
 * section 3 changes: three small reads instead of the all-in-one evidence package.
 * 1. The list of changes (this response), about one Git process, answering
 *    "not modified" when nothing changed.
 * 2. One file's diff (`GitDiffRequest`), one Git process.
 * 3. A line range of a file at the last commit or on disk (`TextRangeRequest`), for
 *    context steps; a plain file read or one `git show`.
 */

export type GitChange = (
  | {
      scope: 'staged' | 'unstaged';
      kind: 'added' | 'modified' | 'deleted' | 'renamed' | 'type-changed';
      oldPath: string | null;
      newPath: string | null;
      oldMode: string;
      newMode: string;
      supported: boolean;
    }
  | { scope: 'untracked'; path: string }
  | {
      scope: 'unmerged';
      path: string;
      conflict: 'DD' | 'AU' | 'UD' | 'UA' | 'DU' | 'AA' | 'UU';
    }
) & {
  /**
   * PROPOSED: a cheap "did it change" signal: the blob id for staged files, size
   * and modification time (or one batched hash) for the rest. Reviewed marks and
   * commits send it back, so the server can tell what the reviewer saw.
   */
  fingerprint: string;
};

/**
 * PROPOSED: a Git action cut off by a server restart, shown once with what Git
 * reports now. It never locks the project.
 */
export type InterruptedAction = {
  requestId: string;
  action: string;
  /** Git's own words about the state it left, e.g. "A rebase is in progress." */
  gitState: string | null;
};

export type GitStatusResponse = {
  environmentId: string;
  worktreeId: string;
  /** Changes whenever the list does; the "not modified" check compares it. */
  statusToken: string;
  headOid: string | null;
  /** PROPOSED: the last commit's message, for amend. */
  headCommit: { subject: string; body?: string } | null;
  changes: GitChange[];
  /** PROPOSED: branch tracking, for the Git button's primary action and menu. */
  branch: {
    name: string | null;
    upstream: string | null;
    /** Where the upstream points, so fetch, pull and push can check nothing moved. */
    upstreamOid: string | null;
    ahead: number;
    behind: number;
    stashes: { oid: string; message: string }[];
  };
  /** PROPOSED */
  interrupted?: InterruptedAction;
  /**
   * PROPOSED: a merge or rebase Git has not finished (it stopped on a conflict). The
   * conflicted files are the `unmerged` changes.
   */
  inProgress: 'merge' | 'rebase' | null;
};

export type GitChangeSelection =
  | {
      scope: 'staged' | 'unstaged';
      oldPath: string | null;
      newPath: string | null;
    }
  /**
   * PROPOSED: the last commit to the file on disk (`git diff HEAD -- path`). The
   * client reads every tracked change this way: Porcelain commits files as they are on
   * disk, so that is what is reviewed, and a file with staged and unstaged edits shows
   * all of them. Deletions are the last commit's lines, additions the file's lines.
   */
  | { scope: 'head'; oldPath: string | null; newPath: string | null }
  /** PROPOSED: a new file Git does not track yet, diffed against nothing. */
  | { scope: 'untracked'; path: string };

/** One file's diff. PROPOSED: `fingerprint` replaces the status token. */
export type GitDiffRequest = {
  change: GitChangeSelection;
  fingerprint: string;
};

export type GitDiffResponse = {
  worktreeId: string;
  change: GitChangeSelection;
  oldMode: string;
  newMode: string;
  content:
    | { kind: 'text'; patch: string }
    | { kind: 'binary' }
    | { kind: 'metadata-only'; patch: string }
    | {
        kind: 'omitted';
        reason: 'size-limit' | 'unsupported-encoding' | 'unsupported-submodule';
      };
};

/** PROPOSED: a few lines of a file, for a context step or an outdated snippet. */
export type TextRangeRequest = {
  path: string;
  /** `head` is the last commit; `disk` is the working file. */
  at: 'head' | 'disk';
  startLine: number;
  endLine: number;
};

export type TextRangeResponse = {
  path: string;
  at: 'head' | 'disk';
  startLine: number;
  /** The lines asked for, without trailing newlines; shorter when the file ends first. */
  lines: string[];
};
