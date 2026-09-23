import type { GitActionReason } from './git-action-reason.ts';

export type GitActionResult = {
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
