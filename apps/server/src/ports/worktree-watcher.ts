export type WatchedWorktree = {
  projectId: string;
  worktreeId: string;
  root: string;
  available: boolean;
};

export type WatchedProject = {
  projectId: string;
  commonDirectory: string;
};

export type WatchedWorktreeLookup = { worktreeId: string };

export type WatchedProjectLookup = { projectId: string };

export type IgnoreRulesRefresh = 'unchanged' | 'changed';

export type FileWatch = {
  follow(paths: readonly string[]): Promise<void>;
  refreshIgnoreRules(): Promise<IgnoreRulesRefresh>;
  close(): Promise<void>;
};

export type RepositoryWatch = {
  close(): Promise<void>;
};

export type FileWatchRequest = {
  worktree: WatchedWorktree;
  changed: (paths: readonly string[]) => void;
};

export type RepositoryWatchRequest = {
  project: WatchedProject;
  changed: () => void;
};

export interface WorktreeWatcher {
  findWorktree(
    input: WatchedWorktreeLookup,
  ): Promise<WatchedWorktree | undefined>;
  findProject(input: WatchedProjectLookup): WatchedProject | undefined;
  watchFiles(input: FileWatchRequest): Promise<FileWatch>;
  watchRepository(input: RepositoryWatchRequest): Promise<RepositoryWatch>;
}
