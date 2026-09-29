import type { ChangeKind } from '@porcelain/kernel/models';
import type { ChangeDiffContent } from './change-diff.ts';

type BranchHead = { oid: string; ref: string | undefined };

type BranchBase = { ref: string; oid: string };

export type BranchRangeFile = {
  oldPath: string | undefined;
  newPath: string | undefined;
  status: ChangeKind;
  oldMode: string;
  newMode: string;
  oldOid: string | undefined;
  newOid: string | undefined;
};

export type BranchRangeLookup =
  | {
      kind: 'found';
      head: BranchHead;
      base: BranchBase;
      mergeBaseOid: string;
      commits: number;
      files: BranchRangeFile[];
    }
  | { kind: 'no-default-base'; head: BranchHead }
  | { kind: 'missing-base' }
  | { kind: 'unrelated' }
  | { kind: 'unborn' };

export type BranchRangeRequest = {
  worktreeId: string;
  base: string | undefined;
};

type BranchFile = Omit<BranchRangeFile, 'oldOid' | 'newOid'> & {
  path: string;
  fingerprint: string;
};

export type BranchChanges = {
  head: { oid: string; branch: string | undefined };
  base: BranchBase | undefined;
  mergeBaseOid: string | undefined;
  commits: number;
  files: BranchFile[];
};

export type BranchPatchesRequest = {
  worktreeId: string;
  baseOid: string;
  headOid: string;
  paths: string[];
};

type BranchPatch = { paths: string[]; content: ChangeDiffContent };

export type BranchPatches =
  | { kind: 'missing' }
  | { kind: 'over-limit' }
  | { kind: 'within-limit'; patches: BranchPatch[] };

export type BranchDiffs = {
  diffs: { paths: string[]; content: ChangeDiffContent }[];
};

export type BranchBases = {
  defaultRef: string | undefined;
  bases: { ref: string; name: string; remote: boolean }[];
};
