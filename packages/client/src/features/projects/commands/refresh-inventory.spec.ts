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

async function retry(fixture: ReturnType<typeof create>) {
  const command = refreshInventory(fixture.connection);
  fixture.registry.set(command, undefined);
  await Effect.runPromise(
    AtomRegistry.getResult(fixture.registry, command, {
      suspendOnWaiting: true,
    }),
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
  const inventory = readInventory(fixture.connection);
  const stop = fixture.registry.mount(inventory);
  onTestFinished(stop);
  await Effect.runPromise(
    AtomRegistry.getResult(fixture.registry, inventory, {
      suspendOnWaiting: true,
    }),
  );
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
  await Effect.runPromise(
    AtomRegistry.getResult(fixture.registry, inventory, {
      suspendOnWaiting: true,
    }),
  );
  await fixture.connection.runtime.runPromise(
    Reactivity.invalidate([queryKeys.inventory(environmentId)]),
  );
  pendingGet.shift()?.(Response.json(stale));
  await expect.poll(() => pendingGet.length).toBe(1);
  await expect.poll(() => fixture.registry.get(inventory).waiting).toBe(true);
  expect(
    await Effect.runPromise(
      AtomRegistry.getResult(fixture.registry, inventory),
    ),
  ).toEqual(refreshed);
});

it('falls back from an older server refresh 404 to GET and publishes its inventory', async () => {
  const initial: ReadInventoryResponse = {
    environmentId,
    environment: { name: 'Computer', custom: false },
    projects: [],
  };
  const refreshed: ReadInventoryResponse = {
    ...initial,
    projects: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Recovered',
        available: true,
        worktrees: [],
      },
    ],
  };
  const requests: string[] = [];
  let current = initial;
  const fixture = create((path, init) => {
    requests.push(`${init?.method ?? 'GET'} ${path}`);
    if (path === '/api/inventory/refresh')
      return Promise.resolve(new Response(null, { status: 404 }));
    return Promise.resolve(Response.json(current));
  });
  await seed(fixture, initial);
  requests.length = 0;
  current = refreshed;
  await retry(fixture);
  expect(requests).toEqual([
    'POST /api/inventory/refresh',
    'GET /api/inventory',
  ]);
  expect(
    await Effect.runPromise(
      AtomRegistry.getResult(
        fixture.registry,
        readInventory(fixture.connection),
        { suspendOnWaiting: true },
      ),
    ),
  ).toEqual(refreshed);
});

it('does not fall back to GET when refresh fails with a non-404 request error', async ({
  onTestFinished,
}) => {
  const initial: ReadInventoryResponse = {
    environmentId,
    environment: { name: 'Computer', custom: false },
    projects: [],
  };
  const requests: string[] = [];
  const fixture = create((path, init) => {
    requests.push(`${init?.method ?? 'GET'} ${path}`);
    return Promise.resolve(
      path === '/api/inventory/refresh'
        ? new Response(null, { status: 503 })
        : Response.json(initial),
    );
  });
  const inventory = readInventory(fixture.connection);
  onTestFinished(fixture.registry.mount(inventory));
  await Effect.runPromise(
    AtomRegistry.getResult(fixture.registry, inventory, {
      suspendOnWaiting: true,
    }),
  );
  await retry(fixture);
  expect(requests).toEqual([
    'GET /api/inventory',
    'POST /api/inventory/refresh',
  ]);
  await expect(
    Effect.runPromise(
      AtomRegistry.getResult(fixture.registry, inventory, {
        suspendOnWaiting: true,
      }),
    ),
  ).rejects.toMatchObject({ _tag: 'RequestError', status: 503 });
});

it('publishes a retried inventory when only the refreshInventories setter is mounted', async ({
  onTestFinished,
}) => {
  const recovered: ReadInventoryResponse = {
    environmentId,
    environment: { name: 'Computer', custom: false },
    projects: [],
  };
  const pending: ((value: Response) => void)[] = [];
  let reachable = false;
  const fixture = create((path) => {
    if (!reachable)
      return Promise.reject(new TypeError('Network request failed'));
    if (path === '/api/inventory/refresh')
      return new Promise<Response>((resolve) => pending.push(resolve));
    return Promise.resolve(Response.json(recovered));
  });
  const inventory = readInventory(fixture.connection);
  onTestFinished(fixture.registry.mount(inventory));
  await expect(
    Effect.runPromise(
      AtomRegistry.getResult(fixture.registry, inventory, {
        suspendOnWaiting: true,
      }),
    ),
  ).rejects.toMatchObject({ _tag: 'ConnectionError' });
  reachable = true;
  const retryAll = refreshInventories([fixture.connection]);
  onTestFinished(fixture.registry.mount(retryAll));
  fixture.registry.set(retryAll, undefined);
  await expect.poll(() => pending.length).toBe(1);
  await Effect.runPromise(Effect.sleep('50 millis'));
  pending.shift()?.(Response.json(recovered));
  await expect.poll(() => fixture.registry.get(inventory).waiting).toBe(false);
  expect(
    await Effect.runPromise(
      AtomRegistry.getResult(fixture.registry, inventory),
    ),
  ).toEqual(recovered);
});
