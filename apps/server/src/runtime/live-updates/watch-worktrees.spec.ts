import { describe, expect, it } from '@effect/vitest';
import { Context, Deferred, Duration, Effect, Fiber, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { WorktreeWatcher } from '../../ports/worktree-watcher.ts';
import { AnnounceWorktreeChangeUseCasePort } from '../../ports/announce-worktree-change-use-case-port.ts';
import { InventoryRefresh } from '../../ports/inventory-refresh.ts';
import { Logger } from '../../ports/logger.ts';
import { RecordingInventoryRefresh } from '../../../spec/fakes/recording-inventory-refresh.ts';
import { InMemoryWorktreeWatcher } from '../../../spec/fakes/in-memory-worktree-watcher.ts';
import { RecordingWorktreeChanges } from '../../../spec/fakes/recording-worktree-changes.ts';
import { WatchWorktrees } from './watch-worktrees.ts';

const PROJECT = 'project-a';
const OTHER_PROJECT = 'project-b';

function wish(worktreeId: string, projectId = PROJECT) {
  return { projectId, worktreeId, paths: [] };
}

const subject = Effect.fn(function* (
  limits: {
    maxConnections: number;
    maxWatchedWorktrees: number;
    eventBuffer?: number;
  } = {
    maxConnections: 4,
    maxWatchedWorktrees: 4,
  },
  onFilesOpened: (
    changed: (paths: readonly string[]) => void,
  ) => Effect.Effect<void> = () => Effect.void,
) {
  const watcher = new InMemoryWorktreeWatcher({
    worktrees: [
      ...['one', 'two', 'three'].map((worktreeId) => ({
        projectId: PROJECT,
        worktreeId,
        root: `/repositories/${worktreeId}`,
        available: true,
      })),
      {
        projectId: PROJECT,
        worktreeId: 'away',
        root: '/repositories/away',
        available: false,
      },
    ],
    onFilesOpened,
    projects: [
      { projectId: PROJECT, commonDirectory: '/repositories/one/.git' },
    ],
  });
  const events = new RecordingWorktreeChanges();
  const refresh = new RecordingInventoryRefresh();
  const context = yield* Layer.build(
    WatchWorktrees.layer({
      ...limits,
      eventBuffer: limits.eventBuffer ?? 256,
      burst: Duration.millis(1),
      announcedEdit: Duration.millis(50),
    }).pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(AnnounceWorktreeChangeUseCasePort, events),
          Layer.succeed(InventoryRefresh, refresh),
          Layer.succeed(WorktreeWatcher, watcher),
          Layer.succeed(Logger, { failure: () => undefined }),
        ),
      ),
    ),
  );
  const watches = Context.get(context, WatchWorktrees);
  const open = Effect.fn(function* () {
    const opened = yield* watches.open();
    if (opened.kind !== 'opened') throw new Error('The watch was refused');
    return opened.demand;
  });
  const follow = (projects: string[], worktrees: ReturnType<typeof wish>[]) =>
    Effect.flatMap(open(), (demand) => demand.replace({ projects, worktrees }));
  return { watches, watcher, events, refresh, follow, open };
});

describe('WatchWorktrees', () => {
  it.effect(
    'bounds callback bursts and invalidates every watched target when events overflow',
    () =>
      Effect.gen(function* () {
        const { watcher, follow, events, refresh } = yield* subject({
          maxConnections: 4,
          maxWatchedWorktrees: 4,
          eventBuffer: 1,
        });
        yield* follow([], [wish('one'), wish('two')]);
        watcher.changeFiles('one', ['src/first.ts']);
        watcher.changeFiles('two', ['src/overflowed.ts']);
        watcher.changeRepository(PROJECT);
        yield* TestClock.adjust(0);
        expect(events.all()).toEqual([
          { worktreeId: 'one', change: 'files', paths: [] },
          { worktreeId: 'one', change: 'git' },
          { worktreeId: 'two', change: 'files', paths: [] },
          { worktreeId: 'two', change: 'git' },
        ]);
        expect(refresh.isFresh()).toBe(true);
        yield* TestClock.adjust(1);
        expect(events.announced('one')).toEqual({
          worktreeId: 'one',
          change: 'files',
          paths: ['src/first.ts'],
        });
      }),
  );
  it.effect(
    'shares one watcher and follows the union until each demand releases its paths',
    () =>
      Effect.gen(function* () {
        const { watcher, open } = yield* subject();
        const first = yield* open();
        const second = yield* open();
        yield* first.replace({
          projects: [],
          worktrees: [{ ...wish('one'), paths: ['src/a.ts'] }],
        });
        yield* second.replace({
          projects: [],
          worktrees: [{ ...wish('one'), paths: ['src/b.ts'] }],
        });
        expect(watcher.followed('one')).toEqual(['src/a.ts', 'src/b.ts']);
        yield* first.close();
        expect(watcher.followed('one')).toEqual(['src/b.ts']);
        expect(watcher.watched()).toEqual({
          projects: [PROJECT],
          worktrees: ['one'],
        });
        yield* second.close();
        expect(watcher.watched()).toEqual({ projects: [], worktrees: [] });
      }),
  );

  it.effect(
    'releases demand capacity and every watcher when the connection scope closes',
    () =>
      Effect.gen(function* () {
        const { watches, watcher, open } = yield* subject({
          maxConnections: 1,
          maxWatchedWorktrees: 4,
        });
        yield* Effect.scoped(
          Effect.gen(function* () {
            const demand = yield* open();
            yield* demand.replace({
              projects: [PROJECT],
              worktrees: [wish('one')],
            });
          }),
        );
        expect(watcher.watched()).toEqual({ projects: [], worktrees: [] });
        const next = yield* watches.open();
        expect(next.kind).toBe('opened');
      }),
  );

  it.effect(
    'drains a watch being acquired before shutting down and discards its pending events',
    () =>
      Effect.gen(function* () {
        const entered = yield* Deferred.make<void>();
        const released = yield* Deferred.make<void>();
        const { watches, watcher, open, events } = yield* subject(
          undefined,
          () =>
            Deferred.succeed(entered, undefined).pipe(
              Effect.andThen(Deferred.await(released)),
            ),
        );
        const demand = yield* open();
        const replacing = yield* Effect.forkChild(
          demand.replace({ projects: [], worktrees: [wish('one')] }),
        );
        yield* Deferred.await(entered);
        expect(watcher.watched()).toEqual({
          projects: [PROJECT],
          worktrees: ['one'],
        });
        const closing = yield* Effect.forkChild(watches.close());
        yield* Deferred.succeed(released, undefined);
        yield* Fiber.join(replacing);
        watcher.changeFiles('one', ['src/pending.ts']);
        yield* Fiber.join(closing);
        yield* watches.close();
        yield* TestClock.adjust(50);
        expect(watcher.watched()).toEqual({ projects: [], worktrees: [] });
        expect(events.announced('one')).toBeUndefined();
        expect(yield* watches.open()).toEqual({ kind: 'at-capacity' });
      }),
  );

  it.effect(
    'retains file events delivered while the watch is still being opened',
    () =>
      Effect.gen(function* () {
        const { follow, events } = yield* subject(undefined, (changed) =>
          Effect.sync(() => changed(['src/opening.ts'])),
        );
        yield* follow([], [wish('one')]);
        yield* TestClock.adjust(1);
        expect(events.announced('one')).toEqual({
          worktreeId: 'one',
          change: 'files',
          paths: ['src/opening.ts'],
        });
      }),
  );

  it.effect(
    'invalidates files when changed ignore rules alter what the native watcher can see',
    () =>
      Effect.gen(function* () {
        const { watcher, follow, events } = yield* subject();
        yield* follow([], [wish('one')]);
        watcher.changeIgnoreRules('one');
        watcher.changeFiles('one', ['.gitignore']);
        yield* TestClock.adjust(1);
        expect(events.announced('one')).toEqual({
          worktreeId: 'one',
          change: 'files',
          paths: ['.gitignore'],
        });
        yield* TestClock.adjust(1);
        expect(events.announced('one')).toEqual({
          worktreeId: 'one',
          change: 'files',
          paths: [],
        });
      }),
  );
  it.effect(
    'follows the worktrees and projects a client names when they exist',
    () =>
      Effect.gen(function* () {
        const { follow } = yield* subject();
        expect(yield* follow([PROJECT], [wish('one'), wish('gone')])).toEqual({
          projects: [PROJECT],
          worktrees: [{ projectId: PROJECT, worktreeId: 'one' }],
        });
      }),
  );

  it.effect(
    'does not follow a worktree the catalog knows but cannot reach',
    () =>
      Effect.gen(function* () {
        const { follow } = yield* subject();
        const targets = yield* follow([], [wish('away'), wish('one')]);
        expect(targets.worktrees).toEqual([
          { projectId: PROJECT, worktreeId: 'one' },
        ]);
      }),
  );

  it.effect(
    'refuses a worktree named under a project it does not belong to',
    () =>
      Effect.gen(function* () {
        const { follow } = yield* subject();
        const targets = yield* follow([], [wish('one', OTHER_PROJECT)]);
        expect(targets.worktrees).toEqual([]);
        expect(yield* follow([], [wish('one')])).toEqual({
          projects: [PROJECT],
          worktrees: [{ projectId: PROJECT, worktreeId: 'one' }],
        });
      }),
  );

  it.effect('watches no more worktrees than its limit across clients', () =>
    Effect.gen(function* () {
      const { follow } = yield* subject({
        maxConnections: 4,
        maxWatchedWorktrees: 2,
      });
      yield* follow([], [wish('one')]);
      const targets = yield* follow([], [wish('two'), wish('three')]);
      expect(targets.worktrees).toEqual([
        { projectId: PROJECT, worktreeId: 'two' },
      ]);
    }),
  );

  it.effect('refuses a client beyond the connection limit', () =>
    Effect.gen(function* () {
      const { watches } = yield* subject({
        maxConnections: 1,
        maxWatchedWorktrees: 4,
      });
      yield* watches.open();
      expect(yield* watches.open()).toEqual({ kind: 'at-capacity' });
    }),
  );

  it.effect('refuses every client once it is closed', () =>
    Effect.gen(function* () {
      const { watches } = yield* subject();
      yield* watches.close();
      expect(yield* watches.open()).toEqual({ kind: 'at-capacity' });
    }),
  );

  it.effect(
    'announces a burst of file changes once, with every path of the burst',
    () =>
      Effect.gen(function* () {
        const { follow, watcher, events } = yield* subject();
        yield* follow([], [wish('one')]);
        watcher.changeFiles('one', ['src/a.ts']);
        watcher.changeFiles('one', ['src/b.ts']);
        yield* TestClock.adjust(1);
        expect(events.announced('one')).toEqual({
          worktreeId: 'one',
          change: 'files',
          paths: ['src/a.ts', 'src/b.ts'],
        });
      }),
  );

  it.effect(
    'skips a changed path that an edit already announced, and still announces the others',
    () =>
      Effect.gen(function* () {
        const { watches, follow, watcher, events } = yield* subject();
        yield* follow([], [wish('one')]);
        yield* watches.announce({ worktreeId: 'one', paths: ['src/a.ts'] });
        watcher.changeFiles('one', ['src/a.ts', 'src/b.ts']);
        yield* TestClock.adjust(1);
        expect(events.announced('one')).toEqual({
          worktreeId: 'one',
          change: 'files',
          paths: ['src/b.ts'],
        });
      }),
  );

  it.effect(
    'reacts to nothing when every changed path was already announced by an edit, while the same change elsewhere is announced',
    () =>
      Effect.gen(function* () {
        const { watches, follow, watcher, events } = yield* subject();
        yield* follow([], [wish('one'), wish('two')]);
        yield* watches.announce({ worktreeId: 'one', paths: ['src/a.ts'] });
        watcher.changeFiles('one', ['src/a.ts']);
        watcher.changeFiles('two', ['src/a.ts']);
        yield* TestClock.adjust(1);
        expect(events.announced('one')).toBeUndefined();
        expect(events.announced('two')).toEqual({
          worktreeId: 'two',
          change: 'files',
          paths: ['src/a.ts'],
        });
      }),
  );

  it.effect(
    'reacts to a change of an announced path once the announcement has expired',
    () =>
      Effect.gen(function* () {
        const { watches, follow, watcher, events } = yield* subject();
        yield* follow([], [wish('one')]);
        yield* watches.announce({ worktreeId: 'one', paths: ['src/a.ts'] });
        yield* TestClock.adjust(50);
        watcher.changeFiles('one', ['src/a.ts']);
        yield* TestClock.adjust(1);
        expect(events.announced('one')).toEqual({
          worktreeId: 'one',
          change: 'files',
          paths: ['src/a.ts'],
        });
      }),
  );

  it.effect(
    'announces a repository change to every watched worktree of the project and refreshes the inventory',
    () =>
      Effect.gen(function* () {
        const { follow, watcher, events, refresh } = yield* subject();
        yield* follow([PROJECT], [wish('one'), wish('two')]);
        watcher.changeRepository(PROJECT);
        yield* TestClock.adjust(1);
        expect([events.announced('one'), events.announced('two')]).toEqual([
          { worktreeId: 'one', change: 'git' },
          { worktreeId: 'two', change: 'git' },
        ]);
        expect(refresh.isFresh()).toBe(true);
      }),
  );

  it.effect('stops watching a worktree once no client names it', () =>
    Effect.gen(function* () {
      const { watcher, open } = yield* subject();
      const demand = yield* open();
      yield* demand.replace({ projects: [PROJECT], worktrees: [wish('one')] });
      yield* demand.replace({ projects: [], worktrees: [] });
      yield* TestClock.adjust(1);
      expect(watcher.watched()).toEqual({ worktrees: [], projects: [] });
    }),
  );
});
