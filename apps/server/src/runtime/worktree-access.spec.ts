import { nativeOperation, nativeWrite } from '@porcelain/effects';
import { describe, expect, it } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
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
  it('refuses a queued read before touching a worktree that changed while waiting', async () => {
    const holding = Promise.withResolvers<void>();
    const checked = Promise.withResolvers<void>();
    let changed = false;
    let reads = 0;
    const consistency = {
      execute: () =>
        Effect.suspend(() =>
          changed ? Effect.fail(new WorktreeChangedError()) : Effect.void,
        ),
    };
    const laneRuntime = ManagedRuntime.make(
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
    const lanes = await laneRuntime.runPromise(Lanes);
    const access = Effect.runSync(
      WorktreeAccess.pipe(
        Effect.provide(WorktreeAccess.layer),
        Effect.provideService(CheckWorktreeUseCasePort, {
          execute: () => {
            checked.resolve();
            return Effect.succeed(worktree);
          },
        }),
        Effect.provideService(WorktreeConsistencyProbe, consistency),
        Effect.provideService(Lanes, lanes),
        Effect.provideService(
          LaneKeys,
          Effect.runSync(LaneKeys.pipe(Effect.provide(LaneKeys.layer))),
        ),
      ),
    );
    const writer = Effect.runPromise(
      lanes.run('repository', 'write', () =>
        nativeOperation(() => holding.promise),
      ),
    );
    const read = Effect.runPromiseExit(
      access.read('tree', () =>
        Effect.sync(() => {
          reads += 1;
          return 'text';
        }),
      ),
    );
    await checked.promise;
    changed = true;
    holding.resolve();
    await writer;
    const exit = await read;
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(
      WorktreeChangedError,
    );
    expect(reads).toBe(0);
    await laneRuntime.dispose();
  });

  it('refuses publication if identity changes during a read', async () => {
    let changed = false;
    const consistency = {
      execute: () =>
        Effect.suspend(() =>
          changed ? Effect.fail(new WorktreeChangedError()) : Effect.void,
        ),
    };
    const laneRuntime = ManagedRuntime.make(
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
    const lanes = await laneRuntime.runPromise(Lanes);
    const access = Effect.runSync(
      WorktreeAccess.pipe(
        Effect.provide(WorktreeAccess.layer),
        Effect.provideService(CheckWorktreeUseCasePort, {
          execute: () => Effect.succeed(worktree),
        }),
        Effect.provideService(WorktreeConsistencyProbe, consistency),
        Effect.provideService(Lanes, lanes),
        Effect.provideService(
          LaneKeys,
          Effect.runSync(LaneKeys.pipe(Effect.provide(LaneKeys.layer))),
        ),
      ),
    );
    const exit = await Effect.runPromiseExit(
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
    await laneRuntime.dispose();
  });

  it('requires an available project for writes and passes the checked identity', async () => {
    const requests: Parameters<CheckWorktreeUseCasePort['execute']>[0][] = [];
    const consistency = { execute: () => Effect.void };
    const laneRuntime = ManagedRuntime.make(
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
    const lanes = await laneRuntime.runPromise(Lanes);
    const access = Effect.runSync(
      WorktreeAccess.pipe(
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
          Effect.runSync(LaneKeys.pipe(Effect.provide(LaneKeys.layer))),
        ),
      ),
    );
    await expect(
      Effect.runPromise(
        access.write('tree', (selected) =>
          Effect.succeed(selected.repositoryId),
        ),
      ),
    ).resolves.toBe('repository');
    expect(requests).toEqual([
      { worktreeId: 'tree', requireAvailableProject: true },
    ]);
    await laneRuntime.dispose();
  });

  it('keeps a missing worktree in the failure channel and unexpected faults as defects', async () => {
    const consistency = { execute: () => Effect.void };
    const laneRuntime = ManagedRuntime.make(
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
    const lanes = await laneRuntime.runPromise(Lanes);
    const missing = new WorktreeNotFoundError();
    const expected = Effect.runSync(
      WorktreeAccess.pipe(
        Effect.provide(WorktreeAccess.layer),
        Effect.provideService(CheckWorktreeUseCasePort, {
          execute: () => Effect.fail(missing),
        }),
        Effect.provideService(WorktreeConsistencyProbe, consistency),
        Effect.provideService(Lanes, lanes),
        Effect.provideService(
          LaneKeys,
          Effect.runSync(LaneKeys.pipe(Effect.provide(LaneKeys.layer))),
        ),
      ),
    );
    const exit = await Effect.runPromiseExit(
      expected.read('tree', () => Effect.succeed('unreachable')),
    );
    expect(Exit.isFailure(exit) && Cause.hasFails(exit.cause)).toBe(true);
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(missing);
    const fault = new Error('Database unavailable');
    const unexpected = Effect.runSync(
      WorktreeAccess.pipe(
        Effect.provide(WorktreeAccess.layer),
        Effect.provideService(CheckWorktreeUseCasePort, {
          execute: () => Effect.die(fault),
        }),
        Effect.provideService(WorktreeConsistencyProbe, consistency),
        Effect.provideService(Lanes, lanes),
        Effect.provideService(
          LaneKeys,
          Effect.runSync(LaneKeys.pipe(Effect.provide(LaneKeys.layer))),
        ),
      ),
    );
    const crashed = await Effect.runPromiseExit(
      unexpected.read('tree', () => Effect.succeed('unreachable')),
    );
    expect(Exit.isFailure(crashed) && Cause.hasDies(crashed.cause)).toBe(true);
    expect(Exit.isFailure(crashed) && Cause.squash(crashed.cause)).toBe(fault);
    await laneRuntime.dispose();
  });
});

it('publishes a confirmed filesystem commit after cancellation and native cleanup release its lease', async () => {
  const committed = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<string>();
  const published = Promise.withResolvers<void>();
  const consistency = { execute: () => Effect.void };
  const laneRuntime = ManagedRuntime.make(
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
  const lanes = await laneRuntime.runPromise(Lanes);
  const access = Effect.runSync(
    WorktreeAccess.pipe(
      Effect.provide(WorktreeAccess.layer),
      Effect.provideService(CheckWorktreeUseCasePort, {
        execute: () => Effect.succeed(worktree),
      }),
      Effect.provideService(WorktreeConsistencyProbe, consistency),
      Effect.provideService(Lanes, lanes),
      Effect.provideService(
        LaneKeys,
        Effect.runSync(LaneKeys.pipe(Effect.provide(LaneKeys.layer))),
      ),
    ),
  );
  const order: string[] = [];
  const controller = new AbortController();
  const caller = Effect.runPromiseExit(
    access.write(
      'tree',
      () =>
        nativeWrite('tree', (_signal, confirm) => {
          order.push('commit');
          confirm();
          committed.resolve();
          return cleanup.promise.then((value) => {
            order.push('cleanup');
            return value;
          });
        }),
      () =>
        access
          .reviews('tree', 'write', () =>
            Effect.sync(() => {
              order.push('published');
              published.resolve();
            }),
          )
          .pipe(Effect.orDie),
    ),
    { signal: controller.signal },
  );
  await committed.promise;
  controller.abort();
  expect(Exit.isFailure(await caller)).toBe(true);
  expect(order).toEqual(['commit']);
  cleanup.resolve('saved');
  await published.promise;
  expect(order).toEqual(['commit', 'cleanup', 'published']);
  await laneRuntime.dispose();
});

it('publishes a confirmed filesystem change even when later cleanup fails', async () => {
  const consistency = { execute: () => Effect.void };
  const laneRuntime = ManagedRuntime.make(
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
  const lanes = await laneRuntime.runPromise(Lanes);
  const access = Effect.runSync(
    WorktreeAccess.pipe(
      Effect.provide(WorktreeAccess.layer),
      Effect.provideService(CheckWorktreeUseCasePort, {
        execute: () => Effect.succeed(worktree),
      }),
      Effect.provideService(WorktreeConsistencyProbe, consistency),
      Effect.provideService(Lanes, lanes),
      Effect.provideService(
        LaneKeys,
        Effect.runSync(LaneKeys.pipe(Effect.provide(LaneKeys.layer))),
      ),
    ),
  );
  let notifications = 0;
  const failure = new Error('Cannot close the written handle');
  const exit = await Effect.runPromiseExit(
    access.write(
      'tree',
      () =>
        nativeWrite('tree', (_signal, confirm) => {
          confirm();
          return Promise.reject(failure);
        }),
      () =>
        Effect.sync(() => {
          notifications += 1;
        }),
    ),
  );
  expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(failure);
  expect(notifications).toBe(1);
  await laneRuntime.dispose();
});

it('refuses a review commit if worktree identity changes during preparation', async () => {
  let changed = false;
  let writes = 0;
  let publications = 0;
  const consistency = {
    execute: () =>
      Effect.suspend(() =>
        changed ? new WorktreeChangedError() : Effect.void,
      ),
  };
  const laneRuntime = ManagedRuntime.make(
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
  const lanes = await laneRuntime.runPromise(Lanes);
  const access = Effect.runSync(
    WorktreeAccess.pipe(
      Effect.provide(WorktreeAccess.layer),
      Effect.provideService(CheckWorktreeUseCasePort, {
        execute: () => Effect.succeed(worktree),
      }),
      Effect.provideService(WorktreeConsistencyProbe, consistency),
      Effect.provideService(Lanes, lanes),
      Effect.provideService(
        LaneKeys,
        Effect.runSync(LaneKeys.pipe(Effect.provide(LaneKeys.layer))),
      ),
    ),
  );
  const exit = await Effect.runPromiseExit(
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
  await laneRuntime.dispose();
});

it('does not publish a cancelled filesystem operation that never committed', async () => {
  const started = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<void>();
  const consistency = { execute: () => Effect.void };
  const laneRuntime = ManagedRuntime.make(
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
  const lanes = await laneRuntime.runPromise(Lanes);
  const access = Effect.runSync(
    WorktreeAccess.pipe(
      Effect.provide(WorktreeAccess.layer),
      Effect.provideService(CheckWorktreeUseCasePort, {
        execute: () => Effect.succeed(worktree),
      }),
      Effect.provideService(WorktreeConsistencyProbe, consistency),
      Effect.provideService(Lanes, lanes),
      Effect.provideService(
        LaneKeys,
        Effect.runSync(LaneKeys.pipe(Effect.provide(LaneKeys.layer))),
      ),
    ),
  );
  let publications = 0;
  const controller = new AbortController();
  const caller = Effect.runPromiseExit(
    access.write(
      'tree',
      () =>
        nativeWrite('tree', (signal) => {
          signal.addEventListener('abort', () => aborted.resolve(), {
            once: true,
          });
          started.resolve();
          return cleanup.promise;
        }),
      () =>
        Effect.sync(() => {
          publications += 1;
        }),
    ),
    { signal: controller.signal },
  );
  await started.promise;
  controller.abort();
  await aborted.promise;
  expect(Exit.hasInterrupts(await caller)).toBe(true);
  cleanup.resolve();
  await laneRuntime.dispose();
  expect(publications).toBe(0);
});
