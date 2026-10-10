import { fileWatchPaths } from './file-watch-paths.ts';
import { watch as watchDirectory } from 'node:fs';
import * as parcelWatcher from '@parcel/watcher';
import {
  Effect,
  Exit,
  FileSystem,
  Layer,
  Path,
  RcMap,
  Scope,
  Semaphore,
} from 'effect';
import { WorktreeWatchError } from '../../runtime/errors/worktree-watch-error.ts';
import type { Limits } from '../../config/limits.ts';
import { listIgnoredPaths } from '@porcelain/git/inspection';
import { captureGitPlatform } from '@porcelain/git/discovery';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type {
  ListableProject,
  ListedWorktree,
} from '@porcelain/projects/models';
import {
  WorktreeWatcher,
  type FileWatch,
  type IgnoreRulesRefresh,
} from '../../ports/worktree-watcher.ts';

type Subscription = { readonly unsubscribe: Effect.Effect<void> };
type FileWatchState = {
  root: string;
  ignored: string[];
  explicit: string[];
  subscription: Subscription | undefined;
  supplements: Map<string, Scope.Closeable>;
  changed: (paths: readonly string[]) => void;
  closed: boolean;
};

const parcelOperation = <A>(work: () => Promise<A>) =>
  Effect.tryPromise({
    try: work,
    catch: (cause) => new WorktreeWatchError({ cause }),
  }).pipe(Effect.orDie);

function backend(): parcelWatcher.Options {
  return process.platform === 'linux' ? { backend: 'inotify' } : {};
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((path, index) => path === right[index])
  );
}

export const parcelWorktreeWatcherLayer = (options: {
  worktrees: WorktreeAccessReader<ListedWorktree>;
  projects: () => readonly ListableProject[];
  gitDirectory: string;
  isTemporaryWrite: (path: string) => boolean;
  limits: Limits['git'];
}) =>
  Layer.effect(
    WorktreeWatcher,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      const fsCapability = yield* FileSystem.FileSystem;
      const pathCapability = yield* Path.Path;
      const turns = yield* RcMap.make({
        lookup: (_directory: string) => Semaphore.make(1),
        idleTimeToLive: 0,
      });
      const inTurn = <A>(directory: string, work: Effect.Effect<A>) =>
        Effect.scoped(
          Effect.flatMap(RcMap.get(turns, directory), (gate) =>
            gate.withPermit(Effect.uninterruptible(work)),
          ),
        );
      const subscribe = Effect.fn('ParcelWorktreeWatcher.subscribe')(function* (
        directory: string,
        changed: parcelWatcher.SubscribeCallback,
        settings: parcelWatcher.Options,
      ) {
        const subscription = yield* inTurn(
          directory,
          parcelOperation(() =>
            parcelWatcher.subscribe(directory, changed, settings),
          ),
        );
        return {
          unsubscribe: inTurn(
            directory,
            parcelOperation(() => subscription.unsubscribe()),
          ),
        };
      });
      const subscribeFiles = (
        state: FileWatchState,
        ignored: readonly string[],
      ) =>
        subscribe(
          state.root,
          (error, events) => {
            if (state.closed) return;
            if (error) return state.changed([]);
            const paths = fileWatchPaths(
              state.root,
              events,
              options.isTemporaryWrite,
            );
            if (paths) state.changed(paths);
          },
          {
            ...backend(),
            ignore: [
              pathCapability.join(state.root, options.gitDirectory),
              ...ignored.map((path) => pathCapability.join(state.root, path)),
            ],
          },
        );
      const refreshSupplements = Effect.fn(
        'ParcelWorktreeWatcher.refreshSupplements',
      )(function* (state: FileWatchState, scope: Scope.Scope) {
        const ignored = state.explicit.filter((path) =>
          state.ignored.some(
            (root) => path === root || path.startsWith(`${root}/`),
          ),
        );
        const directories = new Set<string>();
        for (const path of ignored) {
          const absolute = pathCapability.resolve(state.root, path);
          if (
            absolute !== state.root &&
            !absolute.startsWith(
              `${pathCapability.resolve(state.root)}${pathCapability.sep}`,
            )
          )
            continue;
          const info = yield* fsCapability
            .stat(absolute)
            .pipe(Effect.catch(() => Effect.succeed(undefined)));
          directories.add(
            info?.type === 'Directory'
              ? absolute
              : pathCapability.dirname(absolute),
          );
        }
        if (state.closed) return;
        for (const [directory, supplement] of state.supplements) {
          if (directories.has(directory)) continue;
          yield* Scope.close(supplement, Exit.void);
          state.supplements.delete(directory);
        }
        for (const directory of directories) {
          if (state.supplements.has(directory)) continue;
          const supplement = yield* Scope.fork(scope);
          state.supplements.set(directory, supplement);
          const watched = yield* Effect.acquireRelease(
            Effect.sync(() => {
              const watcher = watchDirectory(directory, (event, filename) => {
                if (state.closed || (event !== 'change' && event !== 'rename'))
                  return;
                const absolute = filename
                  ? pathCapability.resolve(directory, filename.toString())
                  : directory;
                state.changed([
                  pathCapability
                    .relative(state.root, absolute)
                    .split(pathCapability.sep)
                    .join('/'),
                ]);
              });
              watcher.on('error', () => {
                watcher.close();
                if (state.supplements.get(directory) === supplement)
                  state.supplements.delete(directory);
              });
              return watcher;
            }),
            (watcher) => Effect.sync(() => watcher.close()),
          ).pipe(
            Effect.provideService(Scope.Scope, supplement),
            Effect.catchDefect(() => Effect.succeed(undefined)),
          );
          if (!watched) {
            state.supplements.delete(directory);
            yield* Scope.close(supplement, Exit.void);
          }
        }
      });
      const refreshIgnoreRules = Effect.fn(
        'ParcelWorktreeWatcher.refreshIgnoreRules',
      )(function* (
        state: FileWatchState,
        scope: Scope.Scope,
      ): Effect.fn.Return<IgnoreRulesRefresh> {
        if (state.closed) return 'unchanged';
        const ignored = yield* listIgnoredPaths(
          state.root,
          options.limits,
        ).pipe(provideGit, Effect.orDie);
        if (sameList(ignored, state.ignored)) return 'unchanged';
        if (state.subscription) yield* state.subscription.unsubscribe;
        state.subscription = undefined;
        const opened = yield* Effect.exit(subscribeFiles(state, ignored));
        if (Exit.isFailure(opened)) {
          const restored = yield* subscribeFiles(state, state.ignored);
          if (state.closed) yield* restored.unsubscribe;
          else state.subscription = restored;
          return yield* Effect.failCause(opened.cause);
        }
        if (state.closed) {
          yield* opened.value.unsubscribe;
          return 'unchanged';
        }
        state.subscription = opened.value;
        state.ignored = [...ignored];
        yield* refreshSupplements(state, scope);
        return 'changed';
      });
      return {
        findWorktree: Effect.fn('ParcelWorktreeWatcher.findWorktree')(
          function* (input) {
            const check = yield* options.worktrees.known({
              worktreeId: input.worktreeId,
            });
            return check.kind === 'found'
              ? {
                  projectId: check.worktree.projectId,
                  worktreeId: check.worktree.id,
                  root: check.worktree.path,
                  available: check.worktree.available,
                }
              : undefined;
          },
        ),
        findProject: Effect.fn('ParcelWorktreeWatcher.findProject')((input) =>
          Effect.sync(() => {
            const project = options
              .projects()
              .find((entry) => entry.id === input.projectId);
            return project
              ? {
                  projectId: project.id,
                  commonDirectory: project.commonDirectory,
                }
              : undefined;
          }),
        ),
        watchFiles: Effect.fn('ParcelWorktreeWatcher.watchFiles')(
          function* (input) {
            const scope = yield* Effect.scope;
            const state: FileWatchState = {
              root: input.worktree.root,
              ignored: yield* listIgnoredPaths(
                input.worktree.root,
                options.limits,
              ).pipe(provideGit, Effect.orDie),
              explicit: [],
              subscription: undefined,
              supplements: new Map(),
              changed: input.changed,
              closed: false,
            };
            yield* Effect.acquireRelease(
              Effect.uninterruptible(
                Effect.gen(function* () {
                  state.subscription = yield* subscribeFiles(
                    state,
                    state.ignored,
                  );
                  return state;
                }),
              ),
              (current) =>
                Effect.gen(function* () {
                  current.closed = true;
                  for (const supplement of current.supplements.values())
                    yield* Scope.close(supplement, Exit.void);
                  current.supplements.clear();
                  if (current.subscription)
                    yield* current.subscription.unsubscribe;
                  current.subscription = undefined;
                }),
            );
            return {
              follow: (paths) =>
                Effect.uninterruptible(
                  Effect.gen(function* () {
                    state.explicit = [...paths];
                    yield* refreshSupplements(state, scope);
                  }),
                ),
              refreshIgnoreRules: () =>
                Effect.uninterruptible(refreshIgnoreRules(state, scope)),
            } satisfies FileWatch;
          },
        ),
        watchRepository: Effect.fn('ParcelWorktreeWatcher.watchRepository')(
          function* (input) {
            const unpublished = [
              'objects',
              pathCapability.join('lfs', 'objects'),
              'hooks',
              'logs',
              'worktrees/*/logs/**',
              'fsmonitor--daemon',
              'fsmonitor--daemon.ipc',
            ];
            yield* Effect.acquireRelease(
              subscribe(
                input.project.commonDirectory,
                (error, events) => {
                  if (!error && events.length > 0) input.changed();
                },
                {
                  ...backend(),
                  ignore: unpublished.map((path) =>
                    path.includes('*')
                      ? path
                      : pathCapability.join(
                          input.project.commonDirectory,
                          path,
                        ),
                  ),
                },
              ),
              (subscription) => subscription.unsubscribe,
            );
          },
        ),
      } satisfies WorktreeWatcher;
    }),
  );
