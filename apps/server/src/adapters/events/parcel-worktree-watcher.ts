import { type FSWatcher, watch as watchDirectory } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import * as parcelWatcher from '@parcel/watcher';
import { listIgnoredPaths } from '@porcelain/git/inspection';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type {
  ListableProject,
  ListedWorktree,
} from '@porcelain/projects/models';
import type {
  FileWatch,
  FileWatchRequest,
  IgnoreRulesRefresh,
  RepositoryWatch,
  RepositoryWatchRequest,
  WatchedProject,
  WatchedProjectLookup,
  WatchedWorktree,
  WatchedWorktreeLookup,
  WorktreeWatcher,
} from '../../ports/worktree-watcher.ts';

type Changed = (paths: readonly string[]) => void;

type FileWatchState = {
  root: string;
  ignored: string[];
  explicit: string[];
  subscription: parcelWatcher.AsyncSubscription | undefined;
  supplements: Map<string, FSWatcher>;
  changed: Changed;
  closed: boolean;
};

const withoutUnreadableStat = () => undefined;

function backend(): parcelWatcher.Options {
  return process.platform === 'linux' ? { backend: 'inotify' } : {};
}

function watchIfPossible(
  directory: string,
  listener: (event: string, filename: string | Buffer | null) => void,
): FSWatcher | undefined {
  try {
    return watchDirectory(directory, listener);
  } catch {
    return undefined;
  }
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((path, index) => path === right[index])
  );
}

export class ParcelWorktreeWatcher implements WorktreeWatcher {
  private readonly worktrees: WorktreeAccessReader<ListedWorktree>;
  private readonly projects: () => readonly ListableProject[];
  private readonly gitDirectory: string;
  private readonly isTemporaryWrite: (path: string) => boolean;

  constructor(options: {
    worktrees: WorktreeAccessReader<ListedWorktree>;
    projects: () => readonly ListableProject[];
    gitDirectory: string;
    isTemporaryWrite: (path: string) => boolean;
  }) {
    this.worktrees = options.worktrees;
    this.projects = options.projects;
    this.gitDirectory = options.gitDirectory;
    this.isTemporaryWrite = options.isTemporaryWrite;
  }

  async findWorktree(
    input: WatchedWorktreeLookup,
  ): Promise<WatchedWorktree | undefined> {
    const check = await this.worktrees.known({
      worktreeId: input.worktreeId,
    });
    if (check.kind !== 'found' || !check.worktree.available) return undefined;
    return {
      projectId: check.worktree.projectId,
      worktreeId: check.worktree.id,
      root: check.worktree.path,
    };
  }

  findProject(input: WatchedProjectLookup): WatchedProject | undefined {
    const project = this.projects().find(
      (entry) => entry.id === input.projectId,
    );
    return project
      ? { projectId: project.id, commonDirectory: project.commonDirectory }
      : undefined;
  }

  async watchFiles(input: FileWatchRequest): Promise<FileWatch> {
    const { worktree, changed } = input;
    const state: FileWatchState = {
      root: worktree.root,
      ignored: await listIgnoredPaths(worktree.root),
      explicit: [],
      subscription: undefined,
      supplements: new Map(),
      changed,
      closed: false,
    };
    state.subscription = await this.subscribeFiles(state, state.ignored);
    return {
      follow: (paths) => this.follow(state, paths),
      refreshIgnoreRules: () => this.refreshIgnoreRules(state),
      close: () => this.closeFiles(state),
    };
  }

  async watchRepository(
    input: RepositoryWatchRequest,
  ): Promise<RepositoryWatch> {
    const { project, changed } = input;
    const subscription = await parcelWatcher.subscribe(
      project.commonDirectory,
      (error, events) => {
        if (!error && events.length > 0) changed();
      },
      {
        ...backend(),
        ignore: [
          join(project.commonDirectory, 'objects'),
          join(project.commonDirectory, 'lfs', 'objects'),
          join(project.commonDirectory, 'hooks'),
        ],
      },
    );
    return { close: () => subscription.unsubscribe() };
  }

  private subscribeFiles(
    state: FileWatchState,
    ignored: readonly string[],
  ): Promise<parcelWatcher.AsyncSubscription> {
    return parcelWatcher.subscribe(
      state.root,
      (error, events) => {
        if (error) return state.changed([]);
        state.changed(
          events.flatMap((event) => {
            const path = relative(state.root, event.path);
            if (path === '' || path.startsWith(`..${sep}`) || path === '..')
              return [];
            const reported = path.split(sep).join('/');
            return this.isTemporaryWrite(reported) ? [] : [reported];
          }),
        );
      },
      {
        ...backend(),
        ignore: [
          join(state.root, this.gitDirectory),
          ...ignored.map((path) => join(state.root, path)),
        ],
      },
    );
  }

  private async follow(
    state: FileWatchState,
    paths: readonly string[],
  ): Promise<void> {
    state.explicit = [...paths];
    await this.refreshSupplements(state);
  }

  private async refreshSupplements(state: FileWatchState): Promise<void> {
    const ignored = state.explicit.filter((path) =>
      state.ignored.some(
        (root) => path === root || path.startsWith(`${root}/`),
      ),
    );
    const directories = new Set<string>();
    for (const path of ignored) {
      const absolute = resolve(state.root, path);
      if (
        absolute !== state.root &&
        !absolute.startsWith(`${resolve(state.root)}${sep}`)
      )
        continue;
      const info = await stat(absolute).catch(withoutUnreadableStat);
      directories.add(info?.isDirectory() ? absolute : dirname(absolute));
    }
    if (state.closed) return;
    for (const [directory, watcher] of state.supplements) {
      if (directories.has(directory)) continue;
      watcher.close();
      state.supplements.delete(directory);
    }
    for (const directory of directories)
      if (!state.supplements.has(directory))
        this.superviseDirectory(state, directory);
  }

  private superviseDirectory(state: FileWatchState, directory: string): void {
    const watcher = watchIfPossible(directory, (event, filename) => {
      if (event !== 'change' && event !== 'rename') return;
      const absolute = filename
        ? join(directory, filename.toString())
        : directory;
      state.changed([relative(state.root, absolute).split(sep).join('/')]);
    });
    if (!watcher) return;
    watcher.on('error', () => {
      watcher.close();
      state.supplements.delete(directory);
    });
    state.supplements.set(directory, watcher);
  }

  private async refreshIgnoreRules(
    state: FileWatchState,
  ): Promise<IgnoreRulesRefresh> {
    if (state.closed) return 'unchanged';
    const ignored = await listIgnoredPaths(state.root);
    if (sameList(ignored, state.ignored)) return 'unchanged';
    await state.subscription?.unsubscribe();
    state.subscription = undefined;
    let subscription: parcelWatcher.AsyncSubscription;
    try {
      subscription = await this.subscribeFiles(state, ignored);
    } catch (error) {
      const restored = await this.subscribeFiles(state, state.ignored);
      if (state.closed) await restored.unsubscribe();
      else state.subscription = restored;
      throw error;
    }
    if (state.closed) {
      await subscription.unsubscribe();
      return 'unchanged';
    }
    state.subscription = subscription;
    state.ignored = [...ignored];
    await this.refreshSupplements(state);
    return 'changed';
  }

  private async closeFiles(state: FileWatchState): Promise<void> {
    state.closed = true;
    for (const watcher of state.supplements.values()) watcher.close();
    state.supplements.clear();
    await state.subscription?.unsubscribe();
    state.subscription = undefined;
  }
}
