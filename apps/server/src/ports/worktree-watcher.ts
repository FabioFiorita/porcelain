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
  follow(paths: readonly string[]): Effect.Effect<void>;
  refreshIgnoreRules(): Effect.Effect<IgnoreRulesRefresh>;
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
  ): Effect.Effect<WatchedWorktree | undefined>;
  findProject(
    input: WatchedProjectLookup,
  ): Effect.Effect<WatchedProject | undefined>;
  watchFiles(
    input: FileWatchRequest,
  ): Effect.Effect<FileWatch, never, Scope.Scope>;
  watchRepository(
    input: RepositoryWatchRequest,
  ): Effect.Effect<void, never, Scope.Scope>;
}

export const WorktreeWatcher = Context.Service<
  '@porcelain/server/WorktreeWatcher',
  WorktreeWatcher
>('@porcelain/server/WorktreeWatcher');
import { Context, type Effect, type Scope } from 'effect';
