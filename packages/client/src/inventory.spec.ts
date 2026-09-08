import { expect, test, vi } from 'vitest';
import { readInventory } from './inventory.ts';

const inventory = {
  environmentId: '7fe18f78-1477-4c19-a42b-cdd42f862151',
  projects: [],
};
const signal = new AbortController().signal;

test('authenticates inventory reads and refreshes without caching or redirects', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(inventory)));
  expect(
    await readInventory({
      endpoint: '/api',
      token: 'secret',
      fetch: transport,
      signal,
    }),
  ).toEqual(inventory);
  expect(transport).toHaveBeenCalledWith(
    '/api/inventory',
    expect.objectContaining({
      method: 'GET',
      headers: { authorization: 'Bearer secret' },
      signal,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    }),
  );
  transport.mockResolvedValue(new Response(JSON.stringify(inventory)));
  await readInventory({
    endpoint: '/api',
    token: 'secret',
    fetch: transport,
    signal,
    refresh: true,
  });
  expect(transport).toHaveBeenLastCalledWith(
    '/api/inventory/refresh',
    expect.objectContaining({ method: 'POST' }),
  );
});

test.each([
  [401, '{}', 'Access token was rejected'],
  [500, '{}', 'could not complete'],
  [200, '{}', 'incompatible inventory'],
])(
  'reports a safe error for status %i and incompatible responses',
  async (status, body, message) => {
    await expect(
      readInventory({
        endpoint: '/api',
        token: 'secret',
        signal,
        fetch: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(body, { status })),
      }),
    ).rejects.toThrow(message);
  },
);

test('preserves transport causes and aborts without exposing response bodies', async () => {
  const cause = new Error('network failure');
  const transport = vi.fn<typeof fetch>().mockRejectedValue(cause);
  await expect(
    readInventory({
      endpoint: '/api',
      token: 'secret',
      signal,
      fetch: transport,
    }),
  ).rejects.toMatchObject({
    message: expect.stringContaining('Could not reach'),
    cause,
  });
  const controller = new AbortController();
  controller.abort();
  await expect(
    readInventory({
      endpoint: '/api',
      token: 'secret',
      signal: controller.signal,
      fetch: transport,
    }),
  ).rejects.toBe(cause);
});
