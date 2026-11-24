import { Effect, Fiber, Redacted, Stream } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { afterEach, expect, it } from 'vite-plus/test';
import {
  clientFixtures,
  idleLiveConnectionInput,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import {
  AccessPlatform,
  type AccessPlatformValue,
} from '../../access/ports/access-platform.ts';
import { refreshInventory } from '../commands/projects.ts';
import {
  projectWorktreeSnapshot,
  type WorktreeSnapshot,
} from '../rules/worktree-snapshot.ts';
import { WorktreeSnapshots } from '../store/worktree-snapshot.ts';
import { readInventory } from './inventory.ts';
import { readWorktreeSnapshot } from './worktree-snapshot.ts';

const environmentId = '10000000-0000-4000-8000-000000000001';
const remote = {
  environmentId,
  name: 'Office',
  address: 'http://office.local:4738',
  credential: Redacted.make('fixture'),
  deviceId: 'phone',
};
const initialInventory = {
  environmentId,
  environment: { name: 'Office', custom: true },
  projects: [
    {
      id: '30000000-0000-4000-8000-000000000001',
      name: 'App',
      available: true,
      worktrees: [
        {
          id: 'a'.repeat(32),
          path: '/code/app',
          branch: 'main',
          main: true,
          available: true,
        },
      ],
    },
  ],
};
const previous = projectWorktreeSnapshot(initialInventory, '["phone"]', 10);
const create = clientFixtures(environmentId);
const stop: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of stop.splice(0)) await dispose();
});

type Access = 'online' | 'needs-pairing' | 'other-server' | 'incompatible';

function fixture(access: Access = 'online') {
  const opened = Promise.withResolvers<Response>();
  const refreshed = Promise.withResolvers<Response>();
  const refreshRequested = Promise.withResolvers<void>();
  const client = create((path) => {
    if (path === '/api/inventory/refresh') {
      refreshRequested.resolve();
      return refreshed.promise;
    }
    expect(path).toBe('/api/inventory');
    return opened.promise.then((response) => response.clone());
  });
  const { registry } = client;
  const connection = {
    ...client.connection,
    address: remote.address,
    liveUpdates: idleLiveConnectionInput(environmentId, remote.address)
      .liveUpdates,
  };
  const activity = new Set<() => void>();
  const writes: WorktreeSnapshot[] = [];
  const removed: string[][] = [];
  const values: (WorktreeSnapshot | undefined)[] = [];
  const platform = {
    name: () => 'Test device',
    statusActivity: {
      isActive: () => true,
      subscribe: (change) => {
        activity.add(change);
        return () => activity.delete(change);
      },
    },
    send: (url) => {
      if (access === 'needs-pairing' && url.pathname === '/api/session') {
        return Promise.resolve(
          Response.json({ message: 'Unauthorized' }, { status: 401 }),
        );
      }
      const identity = access === 'other-server' ? 'elsewhere' : environmentId;
      return Promise.resolve(
        Response.json(
          url.pathname === '/api/health'
            ? { status: 'ok', environmentId: identity }
            : url.pathname === '/api/environment'
              ? {
                  name: 'Office',
                  environmentId: identity,
                  version: null,
                  protocol:
                    access === 'incompatible'
                      ? ENVIRONMENT_PROTOCOL + 1
                      : ENVIRONMENT_PROTOCOL,
                }
              : { kind: 'owner' },
        ),
      );
    },
  } satisfies AccessPlatformValue;
  const watch = () => {
    const fiber = Effect.runFork(
      readWorktreeSnapshot({
        remote,
        connection,
      }).pipe(
        Effect.flatMap(
          Stream.runForEach((value) =>
            Effect.sync(() => {
              values.push(value);
            }),
          ),
        ),
        Effect.provideService(AccessPlatform, platform),
        Effect.provideService(AtomRegistry.AtomRegistry, registry),
        Effect.provideService(WorktreeSnapshots, {
          read: () => Effect.succeed(previous),
          write: (_id, snapshot) =>
            Effect.sync(() => {
              writes.push(snapshot);
            }),
          remove: (id, pairing) =>
            Effect.sync(() => {
              removed.push([id, pairing ?? '']);
            }),
        }),
      ),
    );
    stop.push(() => Effect.runPromise(Fiber.interrupt(fiber)).then(() => {}));
  };
  return {
    connection,
    registry,
    opened,
    refreshed,
    refreshRequested,
    activity,
    values,
    writes,
    removed,
    watch,
  };
}

it('shows saved data until a confirmed inventory arrives and releases the reachability probe', async () => {
  const f = fixture();
  f.watch();
  await expect.poll(() => f.values.at(-1)).toEqual(previous);
  await expect.poll(() => f.activity.size).toBe(1);
  expect(f.writes).toEqual([]);
  f.opened.resolve(Response.json(initialInventory));
  await expect.poll(() => f.writes).toMatchObject([{ computerName: 'Office' }]);
  await expect.poll(() => f.values.at(-1)).toBeUndefined();
  await expect.poll(() => f.activity.size).toBe(0);
});

it('keeps saved rows hidden and skips writes while confirmed inventory refreshes', async () => {
  const f = fixture();
  const inventory = readInventory(f.connection);
  const unmount = f.registry.mount(inventory);
  try {
    f.opened.resolve(Response.json(initialInventory));
    await readClientAtom(f.registry, inventory);
    f.registry.set(refreshInventory(f.connection), undefined);
    await f.refreshRequested.promise;
    f.watch();
    await expect.poll(() => f.values).toEqual([undefined]);
    expect(f.writes).toEqual([]);
    f.refreshed.resolve(
      Response.json({
        ...initialInventory,
        environment: { name: 'Studio', custom: true },
      }),
    );
    await expect
      .poll(() => f.writes)
      .toMatchObject([{ computerName: 'Studio' }]);
  } finally {
    unmount();
  }
});

it.each(['needs-pairing', 'other-server', 'incompatible'] as const)(
  'deletes saved Worktrees when the computer reports %s',
  async (access) => {
    const f = fixture(access);
    f.watch();
    await expect.poll(() => f.removed).toEqual([[environmentId, '["phone"]']]);
    await expect.poll(() => f.values.at(-1)).toBeUndefined();
    expect(f.writes).toEqual([]);
  },
);
