export type WatchedWorktree = {
  projectId: string;
  worktreeId: string;
  root: string;
};

export type WatchedProject = {
  projectId: string;
  commonDirectory: string;
};

export type IgnoreRulesRefresh = 'unchanged' | 'changed';

export type FileWatch = {
  follow(paths: readonly string[]): Promise<void>;
  refreshIgnoreRules(): Promise<IgnoreRulesRefresh>;
  close(): Promise<void>;
};

export type RepositoryWatch = {
  close(): Promise<void>;
};

export interface WorktreeWatcher {
  findWorktree(worktreeId: string): Promise<WatchedWorktree | undefined>;
  findProject(projectId: string): WatchedProject | undefined;
  watchFiles(
    worktree: WatchedWorktree,
    changed: (paths: readonly string[]) => void,
  ): Promise<FileWatch>;
  watchRepository(
    project: WatchedProject,
    changed: () => void,
  ): Promise<RepositoryWatch>;
}
