import { Effect, type Scope } from 'effect';
import type {
  FileWatch,
  FileWatchRequest,
  RepositoryWatchRequest,
  WatchedProject,
  WatchedProjectLookup,
  WatchedWorktree,
  WatchedWorktreeLookup,
  WorktreeWatcher,
} from '../../src/ports/worktree-watcher.ts';

type Listeners<T> = Map<string, T>;

export class InMemoryWorktreeWatcher implements WorktreeWatcher {
  private readonly worktrees: ReadonlyMap<string, WatchedWorktree>;
  private readonly projects: ReadonlyMap<string, WatchedProject>;
  private readonly files: Listeners<(paths: readonly string[]) => void> =
    new Map();
  private readonly repositories: Listeners<() => void> = new Map();
  private readonly paths = new Map<string, readonly string[]>();
  private readonly onFilesOpened: (
    changed: (paths: readonly string[]) => void,
  ) => Effect.Effect<void>;
  private readonly ignoreRules = new Map<string, 'unchanged' | 'changed'>();

  constructor(seed: {
    worktrees: readonly WatchedWorktree[];
    projects: readonly WatchedProject[];
    onFilesOpened: (
      changed: (paths: readonly string[]) => void,
    ) => Effect.Effect<void>;
  }) {
    this.onFilesOpened = seed.onFilesOpened;
    this.worktrees = new Map(
      seed.worktrees.map((worktree) => [worktree.worktreeId, worktree]),
    );
    this.projects = new Map(
      seed.projects.map((project) => [project.projectId, project]),
    );
  }

  findWorktree(
    input: WatchedWorktreeLookup,
  ): Effect.Effect<WatchedWorktree | undefined> {
    return Effect.sync(() => this.worktrees.get(input.worktreeId));
  }

  findProject(
    input: WatchedProjectLookup,
  ): Effect.Effect<WatchedProject | undefined> {
    return Effect.sync(() => this.projects.get(input.projectId));
  }

  watchFiles(
    input: FileWatchRequest,
  ): Effect.Effect<FileWatch, never, Scope.Scope> {
    const { worktree, changed } = input;
    return Effect.acquireRelease(
      Effect.gen({ self: this }, function* () {
        this.files.set(worktree.worktreeId, changed);
        yield* this.onFilesOpened(changed);
        return {
          follow: (paths: readonly string[]) =>
            Effect.sync(() => {
              this.paths.set(worktree.worktreeId, [...paths]);
            }),
          refreshIgnoreRules: () =>
            Effect.sync(
              () => this.ignoreRules.get(worktree.worktreeId) ?? 'unchanged',
            ),
        };
      }),
      () =>
        Effect.sync(() => {
          this.files.delete(worktree.worktreeId);
          this.paths.delete(worktree.worktreeId);
        }),
    );
  }

  watchRepository(
    input: RepositoryWatchRequest,
  ): Effect.Effect<void, never, Scope.Scope> {
    const { project, changed } = input;
    return Effect.acquireRelease(
      Effect.sync(() => {
        this.repositories.set(project.projectId, changed);
      }),
      () =>
        Effect.sync(() => {
          this.repositories.delete(project.projectId);
        }),
    );
  }

  changeFiles(worktreeId: string, paths: readonly string[]): void {
    this.files.get(worktreeId)?.(paths);
  }

  changeRepository(projectId: string): void {
    this.repositories.get(projectId)?.();
  }

  changeIgnoreRules(worktreeId: string): void {
    this.ignoreRules.set(worktreeId, 'changed');
  }

  followed(worktreeId: string): readonly string[] {
    return this.paths.get(worktreeId) ?? [];
  }

  watched(): { worktrees: string[]; projects: string[] } {
    return {
      worktrees: [...this.files.keys()],
      projects: [...this.repositories.keys()],
    };
  }
}
