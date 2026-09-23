export type GitActionIntent =
  | {
      action: 'pull';
      remoteName: string;
      sourceRef: string;
      strategy?: 'ff-only' | 'merge' | 'rebase' | undefined;
    }
  | { action: 'fetch'; remoteName: string; sourceRef: string }
  | {
      action: 'push';
      remoteName: string;
      destinationRef: string;
      allowCreate: boolean;
    }
  | {
      action: 'commit';
      message: string;
      paths?: string[] | undefined;
      expectedFiles?: { path: string; fingerprint: string }[] | undefined;
    }
  | {
      action: 'amend';
      message: string;
      paths: string[];
    }
  | { action: 'stash-create'; message: string; includeUntracked: boolean }
  | {
      action: 'stash-apply' | 'stash-pop';
      stashOid: string;
      restoreIndex: boolean;
    }
  | {
      action: 'discard';
      path: string;
      hunk?:
        | {
            scope: 'staged' | 'unstaged';
            startLine: number;
            endLine: number;
          }
        | undefined;
    }
  | { action: 'switch-branch'; branch: string }
  | { action: 'create-branch'; branch: string; switchTo: boolean };

export type GitActionExpectation = {
  headOid: string | null;
  branch: string | null;
  inProgress: 'merge' | 'rebase' | null;
  mergeHeadOid: string | null;
  upstreamOid?: string | null | undefined;
  files?: { path: string; fingerprint: string }[] | undefined;
};

export type GitActionPreview = {
  headOid: string | null;
  branch: string | null;
  staged: boolean;
  trackedChanges: boolean;
  untrackedCount: number;
  inProgress?: 'merge' | null | undefined;
  mergeHeadOid?: string | null | undefined;
  destination?: string;
  trackingOid?: string | null;
  stashOid?: string;
};
export type GitActionReason =
  | 'CHANGED_SINCE_LOOKED'
  | 'STALE_PREPARATION'
  | 'REQUEST_MISMATCH'
  | 'CHECKOUT_BUSY'
  | 'UNSUPPORTED_CONFIGURATION'
  | 'NON_FAST_FORWARD'
  | 'GIT_REJECTED'
  | 'DEADLINE_EXCEEDED'
  | 'OUTCOME_UNKNOWN'
  | 'PROCESS_GROUP_UNCONFIRMED';
type GitActionResult = {
  headOid?: string;
  trackingOid?: string;
  sourceOid?: string;
  destinationRef?: string;
  stashOid?: string;
  stashRetained?: boolean;
  restoreStashOid?: string;
  restoreIndex?: boolean;
  branch?: string;
};
export type GitActionCommand = {
  id: string;
  intent: GitActionIntent;
  preview: GitActionPreview;
};
export type GitActionOutcome = {
  state:
    | 'succeeded'
    | 'no-change'
    | 'rejected'
    | 'conflicted'
    | 'indeterminate'
    | 'interrupted';
  reason?: GitActionReason;
  message?: string;
  result?: GitActionResult;
  refreshRequired: boolean;
};

export type GitActionScope = { projectId: string; worktreeId: string };

export type GitActionPreparation = GitActionScope & {
  id: string;
  expiresAt: number;
  intent: GitActionIntent;
  fingerprint: string;
  preview: GitActionPreview;
};

export type GitActionReceipt = GitActionScope &
  Omit<GitActionOutcome, 'state'> & {
    requestId: string;
    intent?: GitActionIntent;
    expected?: GitActionExpectation;
    requestFingerprint?: string;
    action: GitActionIntent['action'];
    state: GitActionOutcome['state'] | 'running';
    progress?: string[];
    acceptedAt: number;
    finishedAt?: number;
    dismissedAt?: number;
  };
