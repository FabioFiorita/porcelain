import type { WorktreeCleanupRequest } from '@porcelain/kernel/models';
export type WorktreeCleanupTarget = WorktreeCleanupRequest & {
  worktree: {
    id: string;
    path: string;
    branch: string | undefined;
    main: boolean;
    commonDirectory: string;
    repositoryIdentity: string;
    administrativeDirectory: string;
  };
};
