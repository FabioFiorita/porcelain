import {
  Cause,
  Context,
  type Duration,
  Effect,
  Exit,
  type Fiber,
  Layer,
  Queue,
  Ref,
  Scope,
  SynchronizedRef,
} from 'effect';
import type { EditAnnouncementWriter } from '../../ports/edit-announcement-writer.ts';
import {
  AnnounceWorktreeChangeUseCasePort,
  type WorktreeChange,
} from '../../ports/announce-worktree-change-use-case-port.ts';
import type {
  FollowedTargets,
  WatchRequest,
} from '../../ports/followed-targets.ts';
import { InventoryRefresh } from '../../ports/inventory-refresh.ts';
import { Logger } from '../../ports/logger.ts';
import {
  WorktreeWatcher,
  type FileWatch,
  type WatchedProject,
  type WatchedWorktree,
} from '../../ports/worktree-watcher.ts';
import type { OpenedWatch, WatchOpener } from '../../ports/watch-demand.ts';

type WatchWorktreesOptions = {
  maxConnections: number;
  maxWatchedWorktrees: number;
  eventBuffer: number;
  burst: Duration.Duration;
  announcedEdit: Duration.Duration;
};

type Demand = {
  projects: Set<string>;
  worktrees: Map<string, ReadonlySet<string>>;
  closed: boolean;
};

type WorktreeEntry = {
  worktree: WatchedWorktree;
  scope: Scope.Closeable;
  watch: FileWatch;
  demands: Map<Demand, ReadonlySet<string>>;
  pendingPaths: Set<string>;
  announcedPaths: Map<string, number>;
  timer: Fiber.Fiber<void> | undefined;
};

type ProjectEntry = {
  project: WatchedProject;
  scope: Scope.Closeable;
  demands: Set<Demand>;
  timer: Fiber.Fiber<void> | undefined;
};

type WatchEvent =
  | { kind: 'files'; entry: WorktreeEntry; paths: readonly string[] }
  | { kind: 'repository'; entry: ProjectEntry }
  | { kind: 'flush-files'; entry: WorktreeEntry }
  | { kind: 'flush-repository'; entry: ProjectEntry }
  | { kind: 'expire'; entry: WorktreeEntry; paths: readonly string[] };

type Registry = {
  stopped: boolean;
  demands: Set<Demand>;
  worktrees: Map<string, WorktreeEntry>;
  projects: Map<string, ProjectEntry>;
};

function changesIgnoreRules(path: string): boolean {
  return path === '.gitignore' || path.endsWith('/.gitignore');
}

export class WatchWorktrees extends Context.Service<
  WatchWorktrees,
  WatchOpener &
    EditAnnouncementWriter & { readonly close: () => Effect.Effect<void> }
>()('@porcelain/server/WatchWorktrees') {
  static readonly layer = (options: WatchWorktreesOptions) =>
    Layer.effect(
      WatchWorktrees,
      Effect.gen(function* () {
        const watcherCapability = yield* WorktreeWatcher;
        const announceCapability = yield* AnnounceWorktreeChangeUseCasePort;
        const refreshCapability = yield* InventoryRefresh;
        const loggerCapability = yield* Logger;
        const workerScope = yield* Scope.make();
        const events = yield* Queue.bounded<WatchEvent>(options.eventBuffer);
        const overflowed = yield* Ref.make(false);
        const offerExternal = (event: WatchEvent) => {
          if (!Queue.offerUnsafe(events, event))
            Effect.runSync(Ref.set(overflowed, true));
        };
        const registry = yield* SynchronizedRef.make<Registry>({
          stopped: false,
          demands: new Set(),
          worktrees: new Map(),
          projects: new Map(),
        });
        const reportFailure = (cause: Cause.Cause<unknown>) =>
          Effect.sync(() =>
            loggerCapability.failure({
              kind: 'live-updates',
              error: Cause.squash(cause),
            }),
          );
        const guarded = <A, E>(work: Effect.Effect<A, E>) =>
          work.pipe(
            Effect.catchCause((cause) =>
              Cause.hasInterruptsOnly(cause)
                ? Effect.interrupt
                : reportFailure(cause),
            ),
          );
        const update = <A>(work: (state: Registry) => Effect.Effect<A>) =>
          SynchronizedRef.modifyEffect(registry, (state) =>
            Effect.uninterruptible(work(state)).pipe(
              Effect.map((value) => [value, state] as const),
            ),
          );
        const followed = (
          state: Registry,
          demand: Demand,
        ): FollowedTargets => ({
          projects: [...demand.projects],
          worktrees: [...demand.worktrees.keys()].flatMap((worktreeId) => {
            const entry = state.worktrees.get(worktreeId);
            return entry
              ? [{ projectId: entry.worktree.projectId, worktreeId }]
              : [];
          }),
        });
        const followedPaths = (entry: WorktreeEntry) => [
          ...new Set(
            [...entry.demands.values()].flatMap((paths) => [...paths]),
          ),
        ];
        const later = (wait: Duration.Duration, event: WatchEvent) =>
          Effect.forkIn(
            Effect.sleep(wait).pipe(
              Effect.andThen(Queue.offer(events, event)),
              Effect.asVoid,
            ),
            event.entry.scope,
            { startImmediately: true },
          );
        const announceChange = (change: WorktreeChange) =>
          Effect.forkIn(
            guarded(announceCapability.execute(change)),
            workerScope,
            { startImmediately: true },
          ).pipe(Effect.asVoid);
        const stop = (entry: WorktreeEntry | ProjectEntry) =>
          guarded(Scope.close(entry.scope, Exit.void));
        const removeWorktree = Effect.fn('WatchWorktrees.removeWorktree')(
          function* (state: Registry, demand: Demand, worktreeId: string) {
            demand.worktrees.delete(worktreeId);
            const entry = state.worktrees.get(worktreeId);
            if (!entry) return;
            entry.demands.delete(demand);
            if (entry.demands.size > 0)
              yield* guarded(entry.watch.follow(followedPaths(entry)));
            else {
              state.worktrees.delete(worktreeId);
              yield* stop(entry);
            }
          },
        );
        const removeProject = Effect.fn('WatchWorktrees.removeProject')(
          function* (state: Registry, demand: Demand, projectId: string) {
            demand.projects.delete(projectId);
            const entry = state.projects.get(projectId);
            if (!entry) return;
            entry.demands.delete(demand);
            if (entry.demands.size === 0) {
              state.projects.delete(projectId);
              yield* stop(entry);
            }
          },
        );
        const release = (demand: Demand) =>
          update((state) =>
            Effect.gen(function* () {
              if (demand.closed) return;
              demand.closed = true;
              state.demands.delete(demand);
              for (const worktreeId of [...demand.worktrees.keys()])
                yield* removeWorktree(state, demand, worktreeId);
              for (const projectId of [...demand.projects])
                yield* removeProject(state, demand, projectId);
            }),
          );
        const queueFiles = Effect.fn('WatchWorktrees.queueFiles')(function* (
          entry: WorktreeEntry,
          paths: readonly string[],
        ) {
          for (const path of paths) entry.pendingPaths.add(path);
          if (!entry.timer)
            entry.timer = yield* later(options.burst, {
              kind: 'flush-files',
              entry,
            });
        });
        const refreshIgnoreRules = Effect.fn(
          'WatchWorktrees.refreshIgnoreRules',
        )(function* (state: Registry, entries: readonly WorktreeEntry[]) {
          for (const entry of entries) {
            if (state.worktrees.get(entry.worktree.worktreeId) !== entry)
              continue;
            const refreshed = yield* entry.watch
              .refreshIgnoreRules()
              .pipe(
                Effect.catchCause((cause) =>
                  reportFailure(cause).pipe(Effect.as('changed' as const)),
                ),
              );
            if (refreshed === 'changed') yield* queueFiles(entry, []);
          }
        });
        const process = (event: WatchEvent) =>
          update((state) =>
            Effect.gen(function* () {
              if (state.stopped) return;
              switch (event.kind) {
                case 'files':
                  if (
                    state.worktrees.get(event.entry.worktree.worktreeId) ===
                    event.entry
                  )
                    yield* queueFiles(event.entry, event.paths);
                  return;
                case 'repository':
                  if (
                    state.projects.get(event.entry.project.projectId) ===
                      event.entry &&
                    !event.entry.timer
                  )
                    event.entry.timer = yield* later(options.burst, {
                      kind: 'flush-repository',
                      entry: event.entry,
                    });
                  return;
                case 'expire':
                  for (const path of event.paths) {
                    const remaining =
                      (event.entry.announcedPaths.get(path) ?? 1) - 1;
                    if (remaining > 0)
                      event.entry.announcedPaths.set(path, remaining);
                    else event.entry.announcedPaths.delete(path);
                  }
                  return;
                case 'flush-files': {
                  if (
                    state.worktrees.get(event.entry.worktree.worktreeId) !==
                    event.entry
                  )
                    return;
                  event.entry.timer = undefined;
                  const pending = [...event.entry.pendingPaths];
                  event.entry.pendingPaths.clear();
                  const changed = pending.filter(
                    (path) => !event.entry.announcedPaths.has(path),
                  );
                  if (pending.length === 0 || changed.length > 0)
                    yield* announceChange({
                      worktreeId: event.entry.worktree.worktreeId,
                      change: 'files',
                      paths: changed,
                    });
                  if (pending.some(changesIgnoreRules))
                    yield* refreshIgnoreRules(state, [event.entry]);
                  return;
                }
                case 'flush-repository': {
                  if (
                    state.projects.get(event.entry.project.projectId) !==
                    event.entry
                  )
                    return;
                  event.entry.timer = undefined;
                  const watched = [...state.worktrees.values()].filter(
                    (worktree) =>
                      worktree.worktree.projectId ===
                      event.entry.project.projectId,
                  );
                  for (const worktree of watched)
                    yield* announceChange({
                      worktreeId: worktree.worktree.worktreeId,
                      change: 'git',
                    });
                  yield* Effect.forkIn(
                    guarded(refreshCapability.execute()),
                    workerScope,
                    { startImmediately: true },
                  );
                  yield* refreshIgnoreRules(state, watched);
                  return;
                }
              }
            }),
          );
        const recoverOverflow = () =>
          update((state) =>
            Effect.gen(function* () {
              if (state.stopped) return;
              const watched = [...state.worktrees.values()];
              for (const entry of watched) {
                yield* announceChange({
                  worktreeId: entry.worktree.worktreeId,
                  change: 'files',
                  paths: [],
                });
                yield* announceChange({
                  worktreeId: entry.worktree.worktreeId,
                  change: 'git',
                });
              }
              yield* Effect.forkIn(
                guarded(refreshCapability.execute()),
                workerScope,
                { startImmediately: true },
              );
              yield* refreshIgnoreRules(state, watched);
            }),
          );
        yield* Effect.forkIn(
          Effect.forever(
            Effect.gen(function* () {
              const event = yield* Queue.take(events);
              yield* process(event);
              if (yield* Ref.getAndSet(overflowed, false))
                yield* recoverOverflow();
            }),
          ),
          workerScope,
        );
        const close = yield* Effect.cached(
          Effect.uninterruptible(
            Effect.gen(function* () {
              const remaining = yield* update((state) =>
                Effect.sync(() => {
                  state.stopped = true;
                  for (const demand of state.demands) {
                    demand.closed = true;
                    demand.worktrees.clear();
                    demand.projects.clear();
                  }
                  state.demands.clear();
                  const entries = [
                    ...state.worktrees.values(),
                    ...state.projects.values(),
                  ];
                  state.worktrees.clear();
                  state.projects.clear();
                  return entries;
                }),
              );
              yield* Scope.close(workerScope, Exit.void);
              yield* Queue.shutdown(events);
              yield* Effect.forEach(remaining, stop, {
                concurrency: 'unbounded',
                discard: true,
              });
            }),
          ),
        );
        yield* Effect.addFinalizer(() => close);
        const replace = (demand: Demand, request: WatchRequest) =>
          update((state) =>
            Effect.gen(function* () {
              if (demand.closed || state.stopped)
                return followed(state, demand);
              const wanted = new Map(
                request.worktrees.map((entry) => [
                  entry.worktreeId,
                  { projectId: entry.projectId, paths: new Set(entry.paths) },
                ]),
              );
              const wantedProjects = new Set([
                ...request.projects,
                ...[...wanted.values()].map((entry) => entry.projectId),
              ]);
              for (const projectId of [...demand.projects])
                if (!wantedProjects.has(projectId))
                  yield* removeProject(state, demand, projectId);
              for (const projectId of wantedProjects) {
                if (demand.projects.has(projectId)) continue;
                const existing = state.projects.get(projectId);
                if (existing) {
                  existing.demands.add(demand);
                  demand.projects.add(projectId);
                  continue;
                }
                const project = yield* watcherCapability.findProject({
                  projectId,
                });
                if (!project) continue;
                const scope = yield* Scope.fork(workerScope);
                const entry: ProjectEntry = {
                  project,
                  scope,
                  demands: new Set(),
                  timer: undefined,
                };
                const opened = yield* Effect.exit(
                  watcherCapability
                    .watchRepository({
                      project,
                      changed: () => {
                        offerExternal({
                          kind: 'repository',
                          entry,
                        });
                      },
                    })
                    .pipe(Effect.provideService(Scope.Scope, scope)),
                );
                if (Exit.isFailure(opened)) {
                  yield* reportFailure(opened.cause);
                  yield* stop(entry);
                  continue;
                }
                entry.demands.add(demand);
                demand.projects.add(projectId);
                state.projects.set(projectId, entry);
              }
              for (const worktreeId of [...demand.worktrees.keys()])
                if (!wanted.has(worktreeId))
                  yield* removeWorktree(state, demand, worktreeId);
              for (const [worktreeId, wish] of wanted) {
                const existing = state.worktrees.get(worktreeId);
                if (existing) {
                  if (existing.worktree.projectId !== wish.projectId) continue;
                  existing.demands.set(demand, wish.paths);
                  demand.worktrees.set(worktreeId, wish.paths);
                  yield* existing.watch.follow(followedPaths(existing));
                  continue;
                }
                if (state.worktrees.size >= options.maxWatchedWorktrees)
                  continue;
                const worktree = yield* watcherCapability.findWorktree({
                  worktreeId,
                });
                if (
                  !worktree ||
                  !worktree.available ||
                  worktree.projectId !== wish.projectId
                )
                  continue;
                const scope = yield* Scope.fork(workerScope);
                let entry: WorktreeEntry | undefined;
                const earlyPaths: string[] = [];
                let changedEarly = false;
                const opened = yield* Effect.exit(
                  watcherCapability
                    .watchFiles({
                      worktree,
                      changed: (paths) => {
                        if (entry)
                          offerExternal({
                            kind: 'files',
                            entry,
                            paths,
                          });
                        else {
                          changedEarly = true;
                          earlyPaths.push(...paths);
                        }
                      },
                    })
                    .pipe(Effect.provideService(Scope.Scope, scope)),
                );
                if (Exit.isFailure(opened)) {
                  yield* reportFailure(opened.cause);
                  yield* guarded(Scope.close(scope, Exit.void));
                  continue;
                }
                entry = {
                  worktree,
                  scope,
                  watch: opened.value,
                  demands: new Map([[demand, wish.paths]]),
                  pendingPaths: new Set(),
                  announcedPaths: new Map(),
                  timer: undefined,
                };
                demand.worktrees.set(worktreeId, wish.paths);
                state.worktrees.set(worktreeId, entry);
                yield* entry.watch.follow(followedPaths(entry));
                if (changedEarly) yield* queueFiles(entry, earlyPaths);
              }
              return followed(state, demand);
            }),
          );
        return {
          open: Effect.fn('WatchWorktrees.open')(function* () {
            return yield* Effect.acquireRelease(
              update((state) =>
                Effect.sync((): OpenedWatch => {
                  if (
                    state.stopped ||
                    state.demands.size >= options.maxConnections
                  )
                    return { kind: 'at-capacity' };
                  const demand: Demand = {
                    projects: new Set(),
                    worktrees: new Map(),
                    closed: false,
                  };
                  state.demands.add(demand);
                  return {
                    kind: 'opened',
                    demand: {
                      replace: (request) => replace(demand, request),
                      close: () => release(demand),
                    },
                  };
                }),
              ),
              (opened) =>
                opened.kind === 'opened' ? opened.demand.close() : Effect.void,
            );
          }),
          announce: Effect.fn('WatchWorktrees.announce')((input) =>
            update((state) =>
              Effect.gen(function* () {
                const entry = state.worktrees.get(input.worktreeId);
                if (!entry || state.stopped) return;
                for (const path of input.paths)
                  entry.announcedPaths.set(
                    path,
                    (entry.announcedPaths.get(path) ?? 0) + 1,
                  );
                yield* later(options.announcedEdit, {
                  kind: 'expire',
                  entry,
                  paths: input.paths,
                });
              }),
            ),
          ),
          close: () => close,
        };
      }),
    );
}
