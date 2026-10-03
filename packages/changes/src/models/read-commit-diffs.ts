import type { CommitDiffs } from './commit-history.ts';

export type ReadCommitDiffsInput = {
  worktreeId: string;
  oid: string;
  parent: number | undefined;
  paths: string[][];
};

export type ReadCommitDiffsResult = CommitDiffs;
