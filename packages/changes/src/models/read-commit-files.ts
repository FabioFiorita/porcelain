import type { CommitFiles } from './commit-history.ts';

export type ReadCommitFilesInput = {
  worktreeId: string;
  oid: string;
  parent: number | undefined;
};

export type ReadCommitFilesResult = CommitFiles;
