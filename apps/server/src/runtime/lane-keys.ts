export interface LaneKeys {
  inventory(): string;
  filesystem(): string;
  project(projectId: string): string;
  worktree(worktreeId: string): string;
}
