import type { ChangeKind } from '@porcelain/kernel/models';
import type { ChangeDiffContent } from './change-diff.ts';

type CommitHead =
  | { kind: 'attached'; ref: string }
  | { kind: 'detached' }
  | { kind: 'unborn'; ref: string };

type HistorySnapshot = {
  tipOid: string | undefined;
  head: CommitHead;
};

export type CommitSummary = {
  oid: string;
  parentOids: string[];
  author: { name: string; timestamp: string };
  subject: string;
  subjectTruncated: boolean;
  body: string | undefined;
  bodyTruncated: boolean;
  refs: string[];
};

export type CommitPage = {
  snapshot: HistorySnapshot | undefined;
  commits: CommitSummary[];
  nextAfter: string[] | undefined;
  tip: string | undefined;
  boundary: 'shallow' | 'wide' | undefined;
  restarted: boolean;
};

type CommitFile = {
  oldPath: string | undefined;
  newPath: string | undefined;
  status: ChangeKind;
  oldMode: string;
  newMode: string;
};

type CommitComparison =
  | { kind: 'parent'; parentNumber: number; baseOid: string }
  | { kind: 'empty-tree' };

export type CommitFiles = {
  commit: CommitSummary;
  comparison: CommitComparison;
  files: CommitFile[];
};

export type CommitFilesLookup =
  | { kind: 'found'; files: CommitFiles }
  | { kind: 'missing' };

export type CommitPatchesRequest = {
  worktreeId: string;
  oid: string;
  parent: number | undefined;
  paths: string[];
};

type CommitPatch = { paths: string[]; content: ChangeDiffContent };

export type CommitPatches =
  | { kind: 'within-limit'; patches: CommitPatch[] }
  | { kind: 'over-limit' };

type CommitDiff = { paths: string[]; content: ChangeDiffContent };

export type CommitDiffs = { commitOid: string; diffs: CommitDiff[] };
