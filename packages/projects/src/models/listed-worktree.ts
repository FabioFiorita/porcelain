import type { Worktree } from '@porcelain/kernel/models';

export type ListedWorktree = Worktree & {
  path: string;
  branch: string | undefined;
  headCommittedAt?: string;
  uncommittedChangedAt?: string;
  main: boolean;
  available: boolean;
  metadataIdentity: string;
  administrativeDirectory: string;
  commonDirectory: string;
  repositoryIdentity: string;
};
