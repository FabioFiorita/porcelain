import type { CommitPage } from './commit-history.ts';

export type ListCommitsInput = {
  worktreeId: string;
  limit: number | undefined;
  after: string[] | undefined;
  tip: string | undefined;
};

export type ListCommitsResult = CommitPage;
