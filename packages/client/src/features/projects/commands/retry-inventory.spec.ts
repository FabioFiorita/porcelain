import { expect, it } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import type { Transport } from '@porcelain/client/transport';
import { InventorySeed, readInventory } from '@porcelain/client/projects';
import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import { retryInventory, retryInventories } from './projects.ts';

const environmentId = '44444444-4444-4444-8444-444444444444';
const create = clientFixtures(environmentId);

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
  first.registry.set(retryInventories(connections), undefined);
  await Effect.runPromise(
    Effect.all(
      connections.map((connection) =>
        AtomRegistry.getResult(first.registry, retryInventory(connection), {
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
