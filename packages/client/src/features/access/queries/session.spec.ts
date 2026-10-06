import { afterEach, describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import type { Transport } from '@porcelain/client/transport';
import type { Principal } from '@porcelain/contracts/access';
import { readBrowserSession } from './session.ts';

const registries = new Set<AtomRegistry.AtomRegistry>();
afterEach(() => {
  for (const registry of registries) registry.dispose();
  registries.clear();
});
function read(transport: Transport) {
  const registry = AtomRegistry.make();
  registries.add(registry);
  return Effect.runPromise(
    AtomRegistry.getResult(registry, readBrowserSession(transport)),
  );
}

it('shares one restore between mounted consumers of the same transport', async () => {
  const registry = AtomRegistry.make();
  registries.add(registry);
  const paths: string[] = [];
  const transport: Transport = (path) => {
    paths.push(path);
    return Promise.resolve(
      Response.json(path === '/api/session' ? { kind: 'owner' } : inventory),
    );
  };
  const first = readBrowserSession(transport);
  const second = readBrowserSession(transport);
  expect(
    await Effect.runPromise(
      Effect.all(
        [
          AtomRegistry.getResult(registry, first),
          AtomRegistry.getResult(registry, second),
        ],
        { concurrency: 'unbounded' },
      ),
    ),
  ).toEqual([
    { inventory, principal: { kind: 'owner' } },
    { inventory, principal: { kind: 'owner' } },
  ]);
  expect(paths).toEqual(['/api/session', '/api/inventory']);
});

it('keeps simultaneously mounted bootstrap transports isolated', async () => {
  const registry = AtomRegistry.make();
  registries.add(registry);
  const firstPaths: string[] = [];
  const secondPaths: string[] = [];
  const otherInventory = {
    ...inventory,
    environmentId: '33333333-3333-4333-8333-333333333333',
  };
  const first = readBrowserSession((path) => {
    firstPaths.push(path);
    return Promise.resolve(
      Response.json(path === '/api/session' ? { kind: 'owner' } : inventory),
    );
  });
  const second = readBrowserSession((path) => {
    secondPaths.push(path);
    return Promise.resolve(
      Response.json(
        path === '/api/session'
          ? {
              kind: 'device',
              deviceId: '22222222-2222-4222-8222-222222222222',
            }
          : otherInventory,
      ),
    );
  });
  const results = await Effect.runPromise(
    Effect.all(
      [
        AtomRegistry.getResult(registry, first),
        AtomRegistry.getResult(registry, second),
      ],
      { concurrency: 'unbounded' },
    ),
  );
  expect(results).toEqual([
    { inventory, principal: { kind: 'owner' } },
    {
      inventory: otherInventory,
      principal: {
        kind: 'device',
        deviceId: '22222222-2222-4222-8222-222222222222',
      },
    },
  ]);
  expect(firstPaths).toEqual(['/api/session', '/api/inventory']);
  expect(secondPaths).toEqual(['/api/session', '/api/inventory']);
});

const inventory = {
  environmentId: '11111111-1111-4111-8111-111111111111',
  environment: { name: 'Computer', custom: false },
  projects: [],
};

describe('browser session restoration', () => {
  it.each<Principal>([
    { kind: 'owner' },
    { kind: 'device', deviceId: '22222222-2222-4222-8222-222222222222' },
  ])(
    'restores the authenticated writer together with its workspace: $kind',
    async (principal) => {
      const paths: string[] = [];
      const restored = read((path) => {
        paths.push(path);
        return Promise.resolve(
          Response.json(path === '/api/session' ? principal : inventory),
        );
      });
      expect(await restored).toEqual({ inventory, principal });
      expect(paths).toEqual(['/api/session', '/api/inventory']);
    },
  );

  it('returns an unpaired session without attempting an authenticated inventory read', async () => {
    const paths: string[] = [];
    const restored = read((path) => {
      paths.push(path);
      return Promise.resolve(new Response(null, { status: 401 }));
    });
    expect(await restored).toBeNull();
    expect(paths).toEqual(['/api/session']);
  });

  it('refuses a workspace when the server cannot identify its authenticated writer', async () => {
    let reads = 0;
    const restored = read(() => {
      reads += 1;
      return Promise.resolve(Response.json({ kind: 'device' }));
    });
    await expect(restored).rejects.toThrow('restore this browser session');
    expect(reads).toBe(1);
  });
});
