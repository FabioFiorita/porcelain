import type { GitActionReason } from '../../shared/errors/git-action-reason.ts';

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
      paths?: readonly string[] | undefined;
      expectedFiles?:
        | readonly { path: string; fingerprint: string }[]
        | undefined;
    }
  | {
      action: 'amend';
      message: string;
      paths: readonly string[];
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
    };

export type GitActionExpectation = {
  headOid: string | null;
  branch: string | null;
  inProgress: 'merge' | 'rebase' | null;
  mergeHeadOid: string | null;
  upstreamOid?: string | null | undefined;
  files?: readonly { path: string; fingerprint: string }[] | undefined;
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
export type GitActionCommand<
  Action extends GitActionIntent['action'] = GitActionIntent['action'],
> = {
  id: string;
  intent: Extract<GitActionIntent, { action: Action }>;
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
