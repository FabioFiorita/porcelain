import { describe, expect, it } from 'vitest';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import type { InventoryConnection } from '@porcelain/client/projects';
import {
  inventoryQueryOptions,
  inventoryScopeQueryOptions,
} from './inventory.ts';

const environmentId = '87deba35-c65b-4fb6-9dfd-52bfbe76f64c';

function inventory(
  name = 'Computer',
  identity = environmentId,
): ReadInventoryResponse {
  return {
    environmentId: identity,
    environment: { name, custom: true },
    projects: [],
  };
}

function connection(
  read: () => ReadInventoryResponse,
  cacheIdentity?: readonly string[],
) {
  const controller = new AbortController();
  const requests: { path: string; signal: AbortSignal | null | undefined }[] =
    [];
  const connected: InventoryConnection = {
    environmentId,
    ...(cacheIdentity === undefined ? {} : { cacheIdentity }),
    request: (signal) => ({
      signal: signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal,
    }),
    transport: (path, init) => {
      requests.push({ path, signal: init?.signal });
      return Promise.resolve(Response.json(read()));
    },
  };
  return { connected, controller, requests };
}

describe('reading a connected project inventory', () => {
  it('reads through its connection and preserves the web inventory cache prefix', async () => {
    const { connected, requests } = connection(() => inventory());
    const options = inventoryQueryOptions(connected);
    expect(
      await options.queryFn({ signal: new AbortController().signal }),
    ).toEqual(inventory());
    expect(options.queryKey).toEqual(['inventory', environmentId]);
    expect(inventoryScopeQueryOptions(environmentId).queryKey).toEqual(
      options.queryKey,
    );
    expect(requests[0]?.path).toBe('/api/inventory');
    expect(requests[0]?.signal?.aborted).toBe(false);
  });

  it('rejects an inventory returned by another installation', async () => {
    const { connected } = connection(() =>
      inventory('Other computer', '7978b5bd-7a5e-49c2-b624-068b2a257fc2'),
    );
    await expect(
      inventoryQueryOptions(connected).queryFn({
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('The connected environment changed.');
  });

  it('rejects a completed read when its connection was cancelled', async () => {
    const { connected, controller, requests } = connection(() => {
      controller.abort();
      return inventory();
    });
    await expect(
      inventoryQueryOptions(connected).queryFn({
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
    expect(requests[0]?.signal?.aborted).toBe(true);
  });

  it('forwards query cancellation even when the connection still exists', async () => {
    const query = new AbortController();
    const { connected, controller, requests } = connection(() => {
      query.abort();
      return inventory();
    });
    await expect(
      inventoryQueryOptions(connected).queryFn({ signal: query.signal }),
    ).rejects.toThrow();
    expect(controller.signal.aborted).toBe(false);
    expect(requests[0]?.signal?.aborted).toBe(true);
  });

  it('keeps native device identity separate under the same environment prefix', () => {
    const first = connection(
      () => inventory(),
      ['https://computer.test', 'first-device'],
    );
    const second = connection(
      () => inventory(),
      ['https://computer.test', 'second-device'],
    );
    const firstOptions = inventoryQueryOptions(first.connected);
    const secondOptions = inventoryQueryOptions(second.connected);
    expect(firstOptions.queryKey).not.toEqual(secondOptions.queryKey);
    expect(firstOptions.queryKey.slice(0, 2)).toEqual(
      inventoryScopeQueryOptions(environmentId).queryKey,
    );
    expect(secondOptions.queryKey).toEqual([
      'inventory',
      environmentId,
      'https://computer.test',
      'second-device',
    ]);
  });
});
