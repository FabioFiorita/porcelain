import { expect, test, vi } from 'vitest';
import {
  browseProjectFolders,
  discoverProjects,
  readInventory,
  registerProject,
  removeProject,
} from './inventory.ts';

const inventory = {
  environmentId: '7fe18f78-1477-4c19-a42b-cdd42f862151',
  projects: [],
};
const signal = new AbortController().signal;

test('reads the inventory without caching, redirects or a second endpoint', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(inventory)));
  expect(
    await readInventory({
      endpoint: '/api',
      fetch: transport,
      signal,
    }),
  ).toEqual(inventory);
  expect(transport).toHaveBeenCalledWith(
    '/api/inventory',
    expect.objectContaining({
      method: 'GET',
      signal,
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'error',
    }),
  );
  // Reading is the only way to ask: there is no second, mutating endpoint a
  // caller could reach for to force a rescan.
  transport.mockResolvedValue(new Response(JSON.stringify(inventory)));
  await readInventory({
    endpoint: '/api',
    fetch: transport,
    signal,
  });
  expect(
    transport.mock.calls.map(([url, init]) => [url, init?.method]),
  ).toEqual([
    ['/api/inventory', 'GET'],
    ['/api/inventory', 'GET'],
  ]);
});

test.each([
  [401, '{}', 'no longer paired'],
  [500, '{}', 'could not complete'],
  [200, '{}', 'incompatible inventory'],
])(
  'reports a safe error for status %i and incompatible responses',
  async (status, body, message) => {
    await expect(
      readInventory({
        endpoint: '/api',
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
        id: '801a86281cd6456281a29c05fba76b4a',
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
      fetch: transport,
      signal,
      path: '/srv/porcelain',
    }),
  ).resolves.toEqual(project);
  expect(transport).toHaveBeenCalledWith(
    '/api/projects',
    expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/srv/porcelain' }),
      signal,
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'error',
    }),
  );
});

test.each([
  [401, 'no longer paired'],
  [400, 'absolute path on the Porcelain server'],
  [422, 'accessible Git repository on the Porcelain server'],
  [500, 'could not open that project'],
])(
  'reports an actionable registration error for status %i',
  async (status, message) => {
    await expect(
      registerProject({
        endpoint: '/api',
        fetch: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response('{}', { status })),
        signal,
        path: '/srv/porcelain',
      }),
    ).rejects.toThrow(message);
  },
);

test('browses encoded server paths with private, cancellable requests', async () => {
  const folder = {
    path: '/srv/a #?&',
    parent: '/srv',
    directories: [],
    repository: true,
    truncated: false,
  };
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(folder)));
  expect(
    await browseProjectFolders({
      endpoint: '/api',
      signal,
      fetch: transport,
      path: folder.path,
    }),
  ).toEqual(folder);
  expect(transport).toHaveBeenCalledWith(
    `/api/projects/folders?${new URLSearchParams({ path: folder.path })}`,
    expect.objectContaining({
      signal,
      cache: 'no-store',
      redirect: 'error',
      credentials: 'same-origin',
    }),
  );
  transport.mockResolvedValue(
    new Response(JSON.stringify({ repositories: [], limited: false })),
  );
  expect(
    await discoverProjects({
      endpoint: '/api',
      signal,
      fetch: transport,
    }),
  ).toEqual({ repositories: [], limited: false });
});

test('reports folder failures without exposing server diagnostics and preserves cancellation', async () => {
  const transport = vi.fn<typeof fetch>();
  for (const status of [401, 400, 404, 422, 500]) {
    transport.mockResolvedValue(
      new Response('private diagnostics', { status }),
    );
    await expect(
      browseProjectFolders({
        endpoint: '/api',
        signal,
        fetch: transport,
      }),
    ).rejects.toThrow(/Porcelain server|no longer paired/);
  }
  transport.mockResolvedValue(
    new Response(JSON.stringify({ repositories: 'wrong' })),
  );
  await expect(
    discoverProjects({
      endpoint: '/api',
      signal,
      fetch: transport,
    }),
  ).rejects.toThrow('Could not load folders or repositories');
  const controller = new AbortController();
  controller.abort(new Error('Cancelled'));
  transport.mockRejectedValue(controller.signal.reason);
  await expect(
    discoverProjects({
      endpoint: '/api',
      signal: controller.signal,
      fetch: transport,
    }),
  ).rejects.toBe(controller.signal.reason);
});

test('removes a project using the authenticated idempotent DELETE endpoint', async () => {
  const transport = vi.fn<typeof fetch>();
  for (const deleted of [true, false]) {
    transport.mockResolvedValue(new Response(JSON.stringify({ deleted })));
    expect(
      await removeProject({
        endpoint: '/api',
        signal,
        fetch: transport,
        projectId: 'project-id',
      }),
    ).toEqual({ deleted });
  }
  expect(transport).toHaveBeenCalledWith(
    '/api/projects/project-id',
    expect.objectContaining({
      method: 'DELETE',
      signal,
      cache: 'no-store',
      redirect: 'error',
    }),
  );
  transport.mockResolvedValue(
    new Response('private diagnostics', { status: 409 }),
  );
  await expect(
    removeProject({
      endpoint: '/api',
      signal,
      fetch: transport,
      projectId: 'project-id',
    }),
  ).rejects.toThrow('active or unresolved Git operation');
  transport.mockResolvedValue(new Response('{}'));
  await expect(
    removeProject({
      endpoint: '/api',
      signal,
      fetch: transport,
      projectId: 'project-id',
    }),
  ).rejects.toThrow('Could not confirm project removal');
});
