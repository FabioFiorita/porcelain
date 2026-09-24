import type {
  FileWatch,
  RepositoryWatch,
  WatchedProject,
  WatchedWorktree,
  WorktreeWatcher,
} from '../../src/ports/worktree-watcher.ts';

export class InMemoryWorktreeWatcher implements WorktreeWatcher {
  readonly worktrees = new Map<string, WatchedWorktree>();
  readonly projects = new Map<string, WatchedProject>();
  readonly fileListeners = new Map<
    string,
    (paths: readonly string[]) => void
  >();
  readonly repositoryListeners = new Map<string, () => void>();

  async findWorktree(worktreeId: string): Promise<WatchedWorktree | undefined> {
    return this.worktrees.get(worktreeId);
  }

  findProject(projectId: string): WatchedProject | undefined {
    return this.projects.get(projectId);
  }

  async watchFiles(
    worktree: WatchedWorktree,
    changed: (paths: readonly string[]) => void,
  ): Promise<FileWatch> {
    this.fileListeners.set(worktree.worktreeId, changed);
    return {
      follow: async () => undefined,
      refreshIgnoreRules: async () => 'unchanged',
      close: async () => {
        this.fileListeners.delete(worktree.worktreeId);
      },
    };
  }

  async watchRepository(
    project: WatchedProject,
    changed: () => void,
  ): Promise<RepositoryWatch> {
    this.repositoryListeners.set(project.projectId, changed);
    return {
      close: async () => {
        this.repositoryListeners.delete(project.projectId);
      },
    };
  }
}
