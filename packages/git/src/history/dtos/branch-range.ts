import type { GitDiffResult } from '../../inspection/index.ts';
import type { CommitFile } from './commit-history.ts';

export type BranchRangeRequest = {
  base?: string;
};

export type BranchFile = CommitFile & {
  oldOid: string | null;
  newOid: string | null;
};

export type BranchHead = {
  oid: string;
  ref: string | null;
};

export type BranchRange =
  | {
      kind: 'found';
      head: BranchHead;
      base: { ref: string; oid: string };
      mergeBaseOid: string;
      commits: number;
      files: BranchFile[];
    }
  | { kind: 'no-default-base'; head: BranchHead }
  | { kind: 'missing-base' }
  | { kind: 'unrelated' }
  | { kind: 'unborn' };

export type BranchDiffsRequest = {
  baseOid: string;
  headOid: string;
  paths: readonly (readonly string[])[];
};

type BranchBase = {
  ref: string;
  name: string;
  remote: boolean;
};

export type BranchBases = {
  defaultRef: string | null;
  bases: BranchBase[];
};

export type BranchDiffs =
  | { kind: 'missing' }
  | { kind: 'read'; sections: Map<string, GitDiffResult> | null };
