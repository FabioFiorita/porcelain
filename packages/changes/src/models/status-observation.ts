import type { ChangeComparison } from './change.ts';

export type ChangeBranchStatus = {
  name: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  remoteName?: string | null;
  sourceRef?: string | null;
  upstreamOid?: string | null;
  stashes?: { oid: string; message: string }[];
  discarded?: {
    oid: string;
    path: string;
    kind: 'hunk' | 'rename';
  }[];
};

export type ChangeStatusObservation = {
  branch?: ChangeBranchStatus;
  statusToken: string;
  headOid: string | null;
  inProgress?: 'merge' | 'rebase' | null;
  mergeHeadOid?: string | null;
  headCommit?: { subject: string; body?: string } | null;
  changes: ChangeComparison[];
};

export type BranchDetails = {
  remoteName: string | null;
  sourceRef: string | null;
  upstreamOid: string | null;
  stashes: { oid: string; message: string }[];
  discarded: { oid: string; path: string; kind: 'hunk' | 'rename' }[];
  headCommit: { subject: string; body?: string } | null;
};

export type ReadWorktreeStatusResult = {
  environmentId: string;
  worktreeId: string;
  status: ChangeStatusObservation;
};
