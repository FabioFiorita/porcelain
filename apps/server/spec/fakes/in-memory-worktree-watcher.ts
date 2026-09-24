import type {
  FileWatch,
  RepositoryWatch,
  WatchedProject,
  WatchedWorktree,
  WorktreeWatcher,
} from '../../src/ports/worktree-watcher.ts';

type Listeners<T> = Map<string, T>;

export class InMemoryWorktreeWatcher implements WorktreeWatcher {
  private readonly worktrees: ReadonlyMap<string, WatchedWorktree>;
  private readonly projects: ReadonlyMap<string, WatchedProject>;
  private readonly files: Listeners<(paths: readonly string[]) => void> =
    new Map();
  private readonly repositories: Listeners<() => void> = new Map();

  constructor(seed: {
    worktrees: readonly WatchedWorktree[];
    projects: readonly WatchedProject[];
  }) {
    this.worktrees = new Map(
      seed.worktrees.map((worktree) => [worktree.worktreeId, worktree]),
    );
    this.projects = new Map(
      seed.projects.map((project) => [project.projectId, project]),
    );
  }

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
    this.files.set(worktree.worktreeId, changed);
    return {
      follow: async () => undefined,
      refreshIgnoreRules: async () => 'unchanged',
      close: async () => {
        this.files.delete(worktree.worktreeId);
      },
    };
  }

  async watchRepository(
    project: WatchedProject,
    changed: () => void,
  ): Promise<RepositoryWatch> {
    this.repositories.set(project.projectId, changed);
    return {
      close: async () => {
        this.repositories.delete(project.projectId);
      },
    };
  }

  changeFiles(worktreeId: string, paths: readonly string[]): void {
    this.files.get(worktreeId)?.(paths);
  }

  changeRepository(projectId: string): void {
    this.repositories.get(projectId)?.();
  }

  watched(): { worktrees: string[]; projects: string[] } {
    return {
      worktrees: [...this.files.keys()],
      projects: [...this.repositories.keys()],
    };
  }
}
