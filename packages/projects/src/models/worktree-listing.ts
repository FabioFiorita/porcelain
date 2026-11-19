import type { ProjectUnavailableReason } from './project-unavailable-reason.ts';
import type { ListedWorktree } from './listed-worktree.ts';

export type WorktreeListing =
  | {
      kind: 'listed';
      projectId: string;
      repositoryIdentity: string;
      worktrees: ListedWorktree[];
      unidentified: number;
    }
  | {
      kind: 'inconclusive';
      projectId: string;
      repositoryIdentity: string;
    }
  | {
      kind: 'unavailable';
      reason: Exclude<ProjectUnavailableReason, 'moved'>;
      projectId: string;
    };
