/**
 * Git actions after the section 9 review: one request per action, no prepare round.
 * The app's confirm dialog stays; right before running, the server checks only what
 * the action depends on (`expected`) and refuses with `CHANGED_SINCE_LOOKED` when it
 * moved. No whole-tree hashing, so no file-count limit. Progress and completion
 * arrive over the live channel; the receipt is also readable by request id.
 */

export type GitAction =
  | 'fetch'
  | 'pull'
  | 'push'
  | 'commit'
  /** PROPOSED */
  | 'amend'
  | 'stash-create'
  | 'stash-apply'
  | 'stash-pop'
  /**
   * PROPOSED: the discarded version is saved first as a stash commit kept out of the
   * stash list (`refs/porcelain/discarded/*`); restoring applies it and drops it.
   */
  | 'discard'
  /** PROPOSED */
  | 'switch-branch'
  /** PROPOSED */
  | 'create-branch';

export type ActionInput =
  | { action: 'fetch'; remoteName: string }
  | {
      action: 'pull';
      remoteName: string;
      strategy: 'ff-only' | 'merge' | 'rebase';
    }
  | {
      action: 'push';
      remoteName: string;
      destinationRef: string;
      allowCreate: boolean;
    }
  /**
   * Commit exactly these paths as they are on disk, whatever the index held. During a
   * merge Git refuses a partial commit: the paths are added and the whole index is
   * committed, which finishes the merge (the client keeps what the merge staged in).
   * `amend` replaces the last commit.
   */
  | { action: 'commit' | 'amend'; message: string; paths: string[] }
  | { action: 'stash-create'; message: string; includeUntracked: boolean }
  | { action: 'stash-apply' | 'stash-pop'; stashOid: string }
  /** A whole file, or one hunk given by its new-side lines. */
  | {
      action: 'discard';
      path: string;
      hunk?: { startLine: number; endLine: number };
    }
  | { action: 'switch-branch'; branch: string }
  | { action: 'create-branch'; branch: string; switchTo: boolean };

/** What the reviewer saw. The server compares only what the action depends on. */
export type Expectation = {
  headOid: string | null;
  /** fetch, pull, push */
  upstreamOid?: string | null;
  /** commit, amend, discard: the fingerprints from the list of changes. */
  files?: { path: string; fingerprint: string }[];
};

/** POST /worktrees/:worktreeId/git/actions */
export type RunGitActionRequest = {
  /** Picked by the client; a retry with the same id returns the same receipt and never runs twice. */
  requestId: string;
  input: ActionInput;
  expected: Expectation;
};

export type ReceiptState =
  | 'running'
  | 'succeeded'
  | 'no-change'
  | 'rejected'
  | 'conflicted'
  /** Cut off by a server restart. Shown once; the project stays usable. */
  | 'interrupted';

export type ReceiptReason =
  /** The files, branch or upstream moved since the reviewer looked. */
  | 'CHANGED_SINCE_LOOKED'
  | 'NON_FAST_FORWARD'
  /** Git refused; `message` carries its words (a branch checked out elsewhere, changes it would overwrite, a lock file). */
  | 'GIT_REJECTED'
  | 'UNSUPPORTED_CONFIGURATION'
  | 'DEADLINE_EXCEEDED';

export type Receipt = {
  requestId: string;
  worktreeId: string;
  action: GitAction;
  state: ReceiptState;
  reason?: ReceiptReason;
  /** Git's own words when it refused or stopped. */
  message?: string;
  /** Progress lines for fetch, pull and push, as they arrived. */
  progress: string[];
  result?: {
    headOid?: string;
    destinationRef?: string;
    stashOid?: string;
    stashRetained?: boolean;
    /** discard: apply this with `stash-apply` to restore what was thrown away. */
    restoreStashOid?: string;
    branch?: string;
  };
  startedAt: number;
  finishedAt?: number;
};

/** PROPOSED: GET /worktrees/:worktreeId/git/branches, for switch and create. */
export type BranchesResponse = {
  current: string | null;
  branches: {
    name: string;
    upstream: string | null;
    lastCommitAt: string;
    /** Git refuses to switch to a branch another worktree has checked out. */
    checkedOutElsewhere: boolean;
  }[];
};

/**
 * GET /git/commit-models: the models the agent CLIs installed on the server can run,
 * ids as `provider:model` (e.g. `claude:sonnet`, `codex:luna`). Empty when no agent
 * CLI is installed or signed in.
 */
export type CommitModel = { id: string; label: string };
export type CommitModelsResponse = CommitModel[];

/** PROPOSED: draft a commit message from the diffs of exactly these files. */
export type CommitMessageRequest = {
  files: { path: string; fingerprint: string }[];
  model: string;
};
export type CommitMessageResponse = { message: string };

/**
 * PROPOSED: split every uncommitted file into commits that each make sense on their
 * own, in the order they should be made. Every file lands in exactly one group.
 */
export type CommitGroupsRequest = {
  files: { path: string; fingerprint: string }[];
  model: string;
};
export type CommitGroupsResponse = {
  groups: { message: string; paths: string[] }[];
};
