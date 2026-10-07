import { admittedWrite } from '@porcelain/effects';
import { describe, expect, it } from '@effect/vitest';
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer } from 'effect';
import {
  WorktreeChangedError,
  WorktreeNotFoundError,
} from '@porcelain/kernel/errors';
import { type ListedWorktree } from '@porcelain/projects/models';
import { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import { LaneKeys } from './lane-keys.ts';
import { Lanes } from './lanes.ts';
import { LaneOptions } from '../ports/lane-options.ts';
import { WorktreeAccess } from './worktree-access.ts';
import { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';

const worktree: ListedWorktree = {
  id: 'tree',
  projectId: 'project',
  repositoryId: 'repository',
  path: '/repo',
  branch: 'refs/heads/main',
  main: true,
  available: true,
  metadataIdentity: 'metadata',
  administrativeDirectory: '/repo/.git',
  commonDirectory: '/repo/.git',
  repositoryIdentity: 'identity',
};

describe('worktree admission', () => {
  it.effect(
    'refuses a queued read before touching a worktree that changed while waiting',
    () =>
      Effect.gen(function* () {
        const holding = Deferred.makeUnsafe<void>();
        const checked = Deferred.makeUnsafe<void>();
        let changed = false;
        let reads = 0;
        const consistency = {
          execute: () =>
            Effect.suspend(() =>
              changed ? Effect.fail(new WorktreeChangedError()) : Effect.void,
            ),
        };
        const laneContext = yield* Layer.build(
          Lanes.layer.pipe(
            Layer.provide(
              Layer.succeed(LaneOptions, {
                readCapacity: 2,
                deadlineMs: 1000,
                consistency,
              }),
            ),
          ),
        );
        const lanes = Context.get(laneContext, Lanes);
        const access = yield* WorktreeAccess.pipe(
          Effect.provide(WorktreeAccess.layer),
          Effect.provideService(CheckWorktreeUseCasePort, {
            execute: () => {
              Deferred.doneUnsafe(checked, Effect.void);
              return Effect.succeed(worktree);
            },
          }),
          Effect.provideService(WorktreeConsistencyProbe, consistency),
          Effect.provideService(Lanes, lanes),
          Effect.provideService(
            LaneKeys,
            yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer)),
          ),
        );
        const writer = yield* Effect.forkChild(
          lanes.run('repository', 'write', () => Deferred.await(holding)),
          { startImmediately: true },
        );
        const read = yield* Effect.forkChild(
          access.read('tree', () =>
            Effect.sync(() => {
              reads += 1;
              return 'text';
            }),
          ),
          { startImmediately: true },
        );
        yield* Deferred.await(checked);
        changed = true;
        yield* Deferred.succeed(holding, undefined);
        yield* Fiber.join(writer);
        const exit = yield* Fiber.await(read);
        expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(
          WorktreeChangedError,
        );
        expect(reads).toBe(0);
        yield* lanes.close();
      }),
  );

  it.effect('refuses publication if identity changes during a read', () =>
    Effect.gen(function* () {
      let changed = false;
      const consistency = {
        execute: () =>
          Effect.suspend(() =>
            changed ? Effect.fail(new WorktreeChangedError()) : Effect.void,
          ),
      };
      const laneContext = yield* Layer.build(
        Lanes.layer.pipe(
          Layer.provide(
            Layer.succeed(LaneOptions, {
              readCapacity: 2,
              deadlineMs: 1000,
              consistency,
            }),
          ),
        ),
      );
      const lanes = Context.get(laneContext, Lanes);
      const access = yield* WorktreeAccess.pipe(
        Effect.provide(WorktreeAccess.layer),
        Effect.provideService(CheckWorktreeUseCasePort, {
          execute: () => Effect.succeed(worktree),
        }),
        Effect.provideService(WorktreeConsistencyProbe, consistency),
        Effect.provideService(Lanes, lanes),
        Effect.provideService(
          LaneKeys,
          yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer)),
        ),
      );
      const exit = yield* Effect.exit(
        access.read('tree', () =>
          Effect.sync(() => {
            changed = true;
            return 'stale';
          }),
        ),
      );
      expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(
        WorktreeChangedError,
      );
      yield* lanes.close();
    }),
  );

  it.effect(
    'requires an available project for writes and passes the checked identity',
    () =>
      Effect.gen(function* () {
        const requests: Parameters<CheckWorktreeUseCasePort['execute']>[0][] =
          [];
        const consistency = { execute: () => Effect.void };
        const laneContext = yield* Layer.build(
          Lanes.layer.pipe(
            Layer.provide(
              Layer.succeed(LaneOptions, {
                readCapacity: 2,
                deadlineMs: 1000,
                consistency,
              }),
            ),
          ),
        );
        const lanes = Context.get(laneContext, Lanes);
        const access = yield* WorktreeAccess.pipe(
          Effect.provide(WorktreeAccess.layer),
          Effect.provideService(CheckWorktreeUseCasePort, {
            execute: (input) => {
              requests.push(input);
              return Effect.succeed(worktree);
            },
          }),
          Effect.provideService(WorktreeConsistencyProbe, consistency),
          Effect.provideService(Lanes, lanes),
          Effect.provideService(
            LaneKeys,
            yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer)),
          ),
        );
        expect(
          yield* access.write('tree', (selected) =>
            Effect.succeed(selected.repositoryId),
          ),
        ).toBe('repository');
        expect(requests).toEqual([
          { worktreeId: 'tree', requireAvailableProject: true },
        ]);
        yield* lanes.close();
      }),
  );

  it.effect(
    'keeps a missing worktree in the failure channel and unexpected faults as defects',
    () =>
      Effect.gen(function* () {
        const consistency = { execute: () => Effect.void };
        const laneContext = yield* Layer.build(
          Lanes.layer.pipe(
            Layer.provide(
              Layer.succeed(LaneOptions, {
                readCapacity: 2,
                deadlineMs: 1000,
                consistency,
              }),
            ),
          ),
        );
        const lanes = Context.get(laneContext, Lanes);
        const missing = new WorktreeNotFoundError();
        const expected = yield* WorktreeAccess.pipe(
          Effect.provide(WorktreeAccess.layer),
          Effect.provideService(CheckWorktreeUseCasePort, {
            execute: () => Effect.fail(missing),
          }),
          Effect.provideService(WorktreeConsistencyProbe, consistency),
          Effect.provideService(Lanes, lanes),
          Effect.provideService(
            LaneKeys,
            yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer)),
          ),
        );
        const exit = yield* Effect.exit(
          expected.read('tree', () => Effect.succeed('unreachable')),
        );
        expect(Exit.isFailure(exit) && Cause.hasFails(exit.cause)).toBe(true);
        expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(missing);
        const fault = new Error('Database unavailable');
        const unexpected = yield* WorktreeAccess.pipe(
          Effect.provide(WorktreeAccess.layer),
          Effect.provideService(CheckWorktreeUseCasePort, {
            execute: () => Effect.die(fault),
          }),
          Effect.provideService(WorktreeConsistencyProbe, consistency),
          Effect.provideService(Lanes, lanes),
          Effect.provideService(
            LaneKeys,
            yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer)),
          ),
        );
        const crashed = yield* Effect.exit(
          unexpected.read('tree', () => Effect.succeed('unreachable')),
        );
        expect(Exit.isFailure(crashed) && Cause.hasDies(crashed.cause)).toBe(
          true,
        );
        expect(Exit.isFailure(crashed) && Cause.squash(crashed.cause)).toBe(
          fault,
        );
        yield* lanes.close();
      }),
  );
});

it.effect(
  'publishes a confirmed filesystem commit after cancellation and native cleanup release its lease',
  () =>
    Effect.gen(function* () {
      const committed = Deferred.makeUnsafe<void>();
      const cleanup = Deferred.makeUnsafe<string>();
      const published = Deferred.makeUnsafe<void>();
      const consistency = { execute: () => Effect.void };
      const laneContext = yield* Layer.build(
        Lanes.layer.pipe(
          Layer.provide(
            Layer.succeed(LaneOptions, {
              readCapacity: 2,
              deadlineMs: 1000,
              consistency,
            }),
          ),
        ),
      );
      const lanes = Context.get(laneContext, Lanes);
      const access = yield* WorktreeAccess.pipe(
        Effect.provide(WorktreeAccess.layer),
        Effect.provideService(CheckWorktreeUseCasePort, {
          execute: () => Effect.succeed(worktree),
        }),
        Effect.provideService(WorktreeConsistencyProbe, consistency),
        Effect.provideService(Lanes, lanes),
        Effect.provideService(
          LaneKeys,
          yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer)),
        ),
      );
      const order: string[] = [];
      const caller = yield* Effect.forkChild(
        access.write(
          'tree',
          () =>
            admittedWrite('tree', (confirm) =>
              Effect.uninterruptible(
                Effect.gen(function* () {
                  order.push('commit');
                  confirm();
                  yield* Deferred.succeed(committed, undefined);
                  const value = yield* Deferred.await(cleanup);
                  order.push('cleanup');
                  return value;
                }),
              ),
            ),
          () =>
            access
              .reviews('tree', 'write', () =>
                Effect.sync(() => {
                  order.push('published');
                  Deferred.doneUnsafe(published, Effect.void);
                }),
              )
              .pipe(Effect.orDie),
        ),
        { startImmediately: true },
      );
      yield* Deferred.await(committed);
      yield* Fiber.interrupt(caller);
      expect(Exit.hasInterrupts(yield* Fiber.await(caller))).toBe(true);
      expect(order).toEqual(['commit']);
      yield* Deferred.succeed(cleanup, 'saved');
      yield* Deferred.await(published);
      expect(order).toEqual(['commit', 'cleanup', 'published']);
      yield* lanes.close();
    }),
);

it.effect(
  'publishes a confirmed filesystem change even when later cleanup fails',
  () =>
    Effect.gen(function* () {
      const consistency = { execute: () => Effect.void };
      const laneContext = yield* Layer.build(
        Lanes.layer.pipe(
          Layer.provide(
            Layer.succeed(LaneOptions, {
              readCapacity: 2,
              deadlineMs: 1000,
              consistency,
            }),
          ),
        ),
      );
      const lanes = Context.get(laneContext, Lanes);
      const access = yield* WorktreeAccess.pipe(
        Effect.provide(WorktreeAccess.layer),
        Effect.provideService(CheckWorktreeUseCasePort, {
          execute: () => Effect.succeed(worktree),
        }),
        Effect.provideService(WorktreeConsistencyProbe, consistency),
        Effect.provideService(Lanes, lanes),
        Effect.provideService(
          LaneKeys,
          yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer)),
        ),
      );
      let notifications = 0;
      const failure = new Error('Cannot close the written handle');
      const exit = yield* Effect.exit(
        access.write(
          'tree',
          () =>
            admittedWrite('tree', (confirm) =>
              Effect.sync(confirm).pipe(Effect.andThen(Effect.die(failure))),
            ),
          () =>
            Effect.sync(() => {
              notifications += 1;
            }),
        ),
      );
      expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(failure);
      expect(notifications).toBe(1);
      yield* lanes.close();
    }),
);

it.effect(
  'refuses a review commit if worktree identity changes during preparation',
  () =>
    Effect.gen(function* () {
      let changed = false;
      let writes = 0;
      let publications = 0;
      const consistency = {
        execute: () =>
          Effect.suspend(() =>
            changed ? new WorktreeChangedError() : Effect.void,
          ),
      };
      const laneContext = yield* Layer.build(
        Lanes.layer.pipe(
          Layer.provide(
            Layer.succeed(LaneOptions, {
              readCapacity: 2,
              deadlineMs: 1000,
              consistency,
            }),
          ),
        ),
      );
      const lanes = Context.get(laneContext, Lanes);
      const access = yield* WorktreeAccess.pipe(
        Effect.provide(WorktreeAccess.layer),
        Effect.provideService(CheckWorktreeUseCasePort, {
          execute: () => Effect.succeed(worktree),
        }),
        Effect.provideService(WorktreeConsistencyProbe, consistency),
        Effect.provideService(Lanes, lanes),
        Effect.provideService(
          LaneKeys,
          yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer)),
        ),
      );
      const exit = yield* Effect.exit(
        access.transaction(
          'tree',
          () =>
            Effect.sync(() => {
              changed = true;
              return 'prepared';
            }),
          () =>
            Effect.sync(() => {
              writes += 1;
            }),
          () =>
            Effect.sync(() => {
              publications += 1;
            }),
        ),
      );
      expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(
        WorktreeChangedError,
      );
      expect(writes).toBe(0);
      expect(publications).toBe(0);
      yield* lanes.close();
    }),
);

it.effect(
  'does not publish a cancelled filesystem operation that never committed',
  () =>
    Effect.gen(function* () {
      const started = Deferred.makeUnsafe<void>();
      const aborted = Deferred.makeUnsafe<void>();
      const cleanup = Deferred.makeUnsafe<void>();
      const consistency = { execute: () => Effect.void };
      const laneContext = yield* Layer.build(
        Lanes.layer.pipe(
          Layer.provide(
            Layer.succeed(LaneOptions, {
              readCapacity: 2,
              deadlineMs: 1000,
              consistency,
            }),
          ),
        ),
      );
      const lanes = Context.get(laneContext, Lanes);
      const access = yield* WorktreeAccess.pipe(
        Effect.provide(WorktreeAccess.layer),
        Effect.provideService(CheckWorktreeUseCasePort, {
          execute: () => Effect.succeed(worktree),
        }),
        Effect.provideService(WorktreeConsistencyProbe, consistency),
        Effect.provideService(Lanes, lanes),
        Effect.provideService(
          LaneKeys,
          yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer)),
        ),
      );
      let publications = 0;
      const caller = yield* Effect.forkChild(
        access.write(
          'tree',
          () =>
            admittedWrite('tree', () =>
              Deferred.succeed(started, undefined).pipe(
                Effect.andThen(Effect.never),
                Effect.ensuring(
                  Deferred.succeed(aborted, undefined).pipe(
                    Effect.andThen(Deferred.await(cleanup)),
                  ),
                ),
              ),
            ),
          () =>
            Effect.sync(() => {
              publications += 1;
            }),
        ),
        { startImmediately: true },
      );
      yield* Deferred.await(started);
      yield* Fiber.interrupt(caller);
      yield* Deferred.await(aborted);
      expect(Exit.hasInterrupts(yield* Fiber.await(caller))).toBe(true);
      yield* Deferred.succeed(cleanup, undefined);
      yield* lanes.close();
      expect(publications).toBe(0);
    }),
);
