import type { ChangeKind } from '@porcelain/kernel/models';
import type { CommitSummary } from './commit-history.ts';

export type ListFileCommitsInput = {
  worktreeId: string;
  path: string;
  limit: number | undefined;
};

type FileCommit = {
  commit: CommitSummary;
  path: string;
  previousPath: string | undefined;
  status: ChangeKind;
};

export type FileCommits = {
  commits: FileCommit[];
  more: boolean;
};
