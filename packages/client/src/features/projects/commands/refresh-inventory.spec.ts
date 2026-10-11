import { expect, it } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import type { Transport } from '@porcelain/client/transport';
import { InventorySeed, readInventory } from '@porcelain/client/projects';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import {
  refreshInventory,
  refreshInventories,
  renameProject,
} from './projects.ts';

const environmentId = '44444444-4444-4444-8444-444444444444';
const create = clientFixtures(environmentId);

async function seed(
  fixture: ReturnType<typeof create>,
  initial: ReadInventoryResponse,
) {
  fixture.connection.atoms.addGlobalLayer(
    Layer.succeed(InventorySeed, Option.some(initial)),
  );
  await Effect.runPromise(
    AtomRegistry.getResult(
      fixture.registry,
      readInventory(fixture.connection),
      { suspendOnWaiting: true },
    ),
  );
}

it('retries every requested environment through POST and publishes the confirmed reason', async () => {
  const requests: { path: string; method: string | undefined }[] = [];
  const initial: ReadInventoryResponse = {
    environmentId,
    environment: { name: 'Computer', custom: false },
    projects: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Project',
        available: true,
        worktrees: [],
      },
    ],
  };
  const refreshed: ReadInventoryResponse = {
    ...initial,
    projects: [
      {
        ...initial.projects[0]!,
        available: false,
        unavailableReason: 'permission',
      },
    ],
  };
  let current = initial;
  const transport: Transport = (path, init) => {
    if (path === '/api/inventory/refresh') {
      requests.push({ path, method: init?.method });
      current = refreshed;
    }
    return Promise.resolve(Response.json(current));
  };
  const first = create(transport);
  const second = create(transport);
  const connections = [first.connection, second.connection];
  for (const connection of connections)
    connection.atoms.addGlobalLayer(
      Layer.succeed(InventorySeed, Option.some(initial)),
    );
  first.registry.set(refreshInventories(connections), undefined);
  await Effect.runPromise(
    Effect.all(
      connections.map((connection) =>
        AtomRegistry.getResult(first.registry, refreshInventory(connection), {
          suspendOnWaiting: true,
        }),
      ),
      { concurrency: 'unbounded' },
    ),
  );
  expect(requests).toEqual([
    { path: '/api/inventory/refresh', method: 'POST' },
    { path: '/api/inventory/refresh', method: 'POST' },
  ]);
  expect(
    await Effect.runPromise(
      AtomRegistry.getResult(first.registry, readInventory(first.connection), {
        suspendOnWaiting: true,
      }),
    ),
  ).toEqual(refreshed);
});

it('rejects refresh answers from a different environment without publishing them', async () => {
  const initial: ReadInventoryResponse = {
    environmentId,
    environment: { name: 'Computer', custom: false },
    projects: [],
  };
  const fixture = create((path) =>
    Promise.resolve(
      Response.json(
        path === '/api/inventory/refresh'
          ? {
              ...initial,
              environmentId: '55555555-5555-4555-8555-555555555555',
            }
          : initial,
      ),
    ),
  );
  await seed(fixture, initial);
  fixture.registry.set(refreshInventory(fixture.connection), undefined);
  await Effect.runPromise(
    AtomRegistry.getResult(
      fixture.registry,
      refreshInventory(fixture.connection),
      { suspendOnWaiting: true },
    ),
  );
  await expect(
    Effect.runPromise(
      AtomRegistry.getResult(
        fixture.registry,
        readInventory(fixture.connection),
        { suspendOnWaiting: true },
      ),
    ),
  ).rejects.toMatchObject({ _tag: 'ConnectionError' });
});

it('keeps a failed refresh outside queued writes and uses its response without another GET', async () => {
  const initial: ReadInventoryResponse = {
    environmentId,
    environment: { name: 'Computer', custom: false },
    projects: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Project',
        available: true,
        worktrees: [],
      },
    ],
  };
  const requests: string[] = [];
  const pending: ((value: Response) => void)[] = [];
  const fixture = create((path, init) => {
    requests.push(`${init?.method ?? 'GET'} ${path}`);
    if (path === '/api/inventory/refresh')
      return new Promise<Response>((resolve) => {
        pending.push(resolve);
      });
    if (init?.method === 'PATCH')
      return Promise.resolve(
        Response.json({ id: initial.projects[0]!.id, name: 'Renamed' }),
      );
    return Promise.resolve(Response.json(initial));
  });
  await seed(fixture, initial);
  requests.length = 0;
  fixture.registry.set(refreshInventory(fixture.connection), undefined);
  await expect.poll(() => pending.length === 1).toBe(true);
  fixture.registry.set(renameProject(fixture.connection), {
    projectId: initial.projects[0]!.id,
    name: 'Renamed',
  });
  try {
    await expect
      .poll(() =>
        requests.includes(`PATCH /api/projects/${initial.projects[0]!.id}`),
      )
      .toBe(true);
  } finally {
    pending.shift()?.(new Response(null, { status: 503 }));
  }
  await Effect.runPromise(
    AtomRegistry.getResult(
      fixture.registry,
      refreshInventory(fixture.connection),
      { suspendOnWaiting: true },
    ),
  );
  await expect(
    Effect.runPromise(
      AtomRegistry.getResult(
        fixture.registry,
        renameProject(fixture.connection),
        { suspendOnWaiting: true },
      ),
    ),
  ).resolves.toEqual({ id: initial.projects[0]!.id, name: 'Renamed' });
  requests.length = 0;
  fixture.registry.set(refreshInventory(fixture.connection), undefined);
  await expect.poll(() => pending.length === 1).toBe(true);
  pending.shift()?.(Response.json(initial));
  await Effect.runPromise(
    AtomRegistry.getResult(
      fixture.registry,
      refreshInventory(fixture.connection),
      { suspendOnWaiting: true },
    ),
  );
  expect(requests).toEqual(['POST /api/inventory/refresh']);
  expect(
    await Effect.runPromise(
      AtomRegistry.getResult(
        fixture.registry,
        readInventory(fixture.connection),
        { suspendOnWaiting: true },
      ),
    ),
  ).toEqual(initial);
});

it('keeps the refresh response when an overlapping live inventory read finishes later', async ({
  onTestFinished,
}) => {
  const stale: ReadInventoryResponse = {
    environmentId,
    environment: { name: 'Computer', custom: false },
    projects: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Project',
        available: false,
        unavailableReason: 'missing',
        worktrees: [],
      },
    ],
  };
  const refreshed: ReadInventoryResponse = {
    ...stale,
    projects: [
      {
        id: stale.projects[0]!.id,
        name: 'Project',
        available: true,
        worktrees: [],
      },
    ],
  };
  const pendingPost: ((value: Response) => void)[] = [];
  const pendingGet: ((value: Response) => void)[] = [];
  let delayGet = false;
  const fixture = create((path) => {
    if (path === '/api/inventory/refresh')
      return new Promise<Response>((resolve) => pendingPost.push(resolve));
    if (delayGet)
      return new Promise<Response>((resolve) => pendingGet.push(resolve));
    return Promise.resolve(Response.json(stale));
  });
  await seed(fixture, stale);
  const stop = fixture.registry.mount(readInventory(fixture.connection));
  onTestFinished(stop);
  fixture.registry.set(refreshInventory(fixture.connection), undefined);
  await expect.poll(() => pendingPost.length).toBe(1);
  delayGet = true;
  await fixture.connection.runtime.runPromise(
    Reactivity.Reactivity.use((reactivity) =>
      reactivity.invalidate([queryKeys.inventory(environmentId)]),
    ),
  );
  await expect.poll(() => pendingGet.length).toBe(1);
  pendingPost.shift()?.(Response.json(refreshed));
  await Effect.runPromise(
    AtomRegistry.getResult(
      fixture.registry,
      refreshInventory(fixture.connection),
      { suspendOnWaiting: true },
    ),
  );
  pendingGet.shift()?.(Response.json(stale));
  await fixture.connection.runtime.runPromise(Effect.yieldNow);
  await expect
    .poll(() => fixture.registry.get(readInventory(fixture.connection)))
    .toMatchObject({ value: refreshed });
});
