import type { ChangeKind } from './change.ts';
import type { ChangeDiffContent } from './change-diff.ts';

export type CommitHead =
  | { kind: 'attached'; ref: string }
  | { kind: 'detached' }
  | { kind: 'unborn'; ref: string };

export type HistorySnapshot = {
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

export type CommitPageRequest = {
  limit: number | undefined;
  after: string[] | undefined;
  tip: string | undefined;
};

export type CommitPage = {
  snapshot: HistorySnapshot | undefined;
  commits: CommitSummary[];
  nextAfter: string[] | undefined;
  tip: string | undefined;
  boundary: 'shallow' | 'wide' | undefined;
  restarted: boolean;
};

export type CommitFile = {
  oldPath: string | undefined;
  newPath: string | undefined;
  status: ChangeKind;
  oldMode: string;
  newMode: string;
};

export type CommitComparison =
  | { kind: 'parent'; parentNumber: number; baseOid: string }
  | { kind: 'empty-tree' };

export type CommitFiles = {
  commit: CommitSummary;
  comparison: CommitComparison;
  files: CommitFile[];
};

export type CommitFilesRequest = {
  oid: string;
  parent: number | undefined;
};

export type CommitPatchesRequest = CommitFilesRequest & { paths: string[] };

export type CommitPatch = { paths: string[]; content: ChangeDiffContent };

export type CommitPatches =
  | { kind: 'within-limit'; patches: CommitPatch[] }
  | { kind: 'over-limit' };

export type CommitDiff = { paths: string[]; content: ChangeDiffContent };

export type CommitDiffs = { commitOid: string; diffs: CommitDiff[] };
