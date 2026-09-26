import type { GitActionReason } from './git-action-reason.ts';

export type GitActionResult = {
  headOid?: string | undefined;
  trackingOid?: string | undefined;
  sourceOid?: string | undefined;
  destinationRef?: string | undefined;
  stashOid?: string | undefined;
  stashRetained?: boolean | undefined;
  restoreStashOid?: string | undefined;
  restoreIndex?: boolean | undefined;
  branch?: string | undefined;
};

export type GitActionOutcome = {
  state:
    | 'succeeded'
    | 'no-change'
    | 'rejected'
    | 'conflicted'
    | 'indeterminate'
    | 'interrupted';
  reason?: GitActionReason | undefined;
  message?: string | undefined;
  result?: GitActionResult | undefined;
  refreshRequired: boolean;
};
