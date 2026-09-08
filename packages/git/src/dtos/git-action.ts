export type GitActionIntent =
  | { action: 'fetch'; remoteName: string; sourceRef: string }
  | {
      action: 'push';
      remoteName: string;
      destinationRef: string;
      allowCreate: boolean;
    }
  | { action: 'commit'; message: string }
  | { action: 'stash-create'; message: string; includeUntracked: boolean }
  | {
      action: 'stash-apply' | 'stash-pop';
      stashOid: string;
      restoreIndex: boolean;
    };

export type GitActionPreview = {
  headOid: string | null;
  branch: string | null;
  staged: boolean;
  trackedChanges: boolean;
  untrackedCount: number;
  destination?: string;
  trackingOid?: string | null;
  stashOid?: string;
};
export type GitActionReason =
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
    | 'indeterminate';
  reason?: GitActionReason;
  result?: GitActionResult;
  refreshRequired: boolean;
};
