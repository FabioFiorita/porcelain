export interface LaneKeys {
  access(): string;
  inventory(): string;
  filesystem(): string;
  project(projectId: string): string;
  worktree(worktreeId: string): string;
}
