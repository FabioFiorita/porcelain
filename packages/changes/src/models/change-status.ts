import type { ChangeComparison } from '@porcelain/kernel/models';

export type BranchStatus = {
  name: string | undefined;
  upstream: string | undefined;
  ahead: number;
  behind: number;
};

export type ChangeStatusObservation = {
  statusToken: string;
  headOid: string | undefined;
  inProgress: 'merge' | 'rebase' | undefined;
  mergeHeadOid: string | undefined;
  branch: BranchStatus | undefined;
  changes: ChangeComparison[];
};

export type Stash = { oid: string; message: string };

export type DiscardedChange = {
  oid: string;
  path: string;
  kind: 'hunk' | 'rename';
};

export type HeadCommit = { subject: string; body?: string | undefined };

export type BranchDetails = {
  remoteName: string | undefined;
  sourceRef: string | undefined;
  upstreamOid: string | undefined;
  stashes: Stash[];
  discarded: DiscardedChange[];
  headCommit: HeadCommit | undefined;
};
