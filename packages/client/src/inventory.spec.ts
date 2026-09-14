import { expect, test, vi } from 'vitest';
import { readInventory, registerProject } from './inventory.ts';

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

test('registers an absolute server-side project without caching or redirects', async () => {
  const project = {
    id: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
    name: 'Porcelain',
    available: true,
    worktrees: [
      {
        id: '801a8628-1cd6-4562-81a2-9c05fba76b4a',
        path: '/srv/porcelain',
        branch: 'refs/heads/main',
        main: true,
        available: true,
      },
    ],
  };
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(project)));

  await expect(
    registerProject({
      endpoint: '/api',
      token: 'secret',
      fetch: transport,
      signal,
      path: '/srv/porcelain',
    }),
  ).resolves.toEqual(project);
  expect(transport).toHaveBeenCalledWith(
    '/api/projects',
    expect.objectContaining({
      method: 'POST',
      headers: {
        authorization: 'Bearer secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ path: '/srv/porcelain' }),
      signal,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    }),
  );
});

test.each([
  [401, 'Access token was rejected'],
  [400, 'absolute path on the Porcelain server'],
  [422, 'accessible Git repository on the Porcelain server'],
  [500, 'could not open that project'],
])(
  'reports an actionable registration error for status %i',
  async (status, message) => {
    await expect(
      registerProject({
        endpoint: '/api',
        token: 'secret',
        fetch: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response('{}', { status })),
        signal,
        path: '/srv/porcelain',
      }),
    ).rejects.toThrow(message);
  },
);
