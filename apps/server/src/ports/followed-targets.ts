export type FollowedTargets = {
  projects: readonly string[];
  worktrees: readonly { projectId: string; worktreeId: string }[];
};

export type WatchRequest = {
  projects: readonly string[];
  worktrees: readonly {
    projectId: string;
    worktreeId: string;
    paths: readonly string[];
  }[];
};
