import { expect, it } from 'vitest';
import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import { refreshReviewList } from '../commands/review-list.ts';
import { readReviewList } from './review-list.ts';

const create = clientFixtures();
const ids = [
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
];

it('combines identical project and checkout IDs from different connections without losing unavailable worktrees', async () => {
  const clients = ids.map((environmentId, index) =>
    create(
      (path) =>
        Promise.resolve(
          Response.json(
            path.startsWith('/api/inventory')
              ? inventoryAnswer(environmentId, index)
              : [],
          ),
        ),
      undefined,
      1000,
      environmentId,
    ),
  );
  const registry = clients[0]!.registry;
  const list = readReviewList(clients.map((client) => client.connection));
  const stop = registry.mount(list);
  try {
    await expect.poll(() => registry.get(list).loading).toBe(false);
    expect(registry.get(list).messages).toEqual([]);
    expect(
      registry
        .get(list)
        .entries.map((entry) => [
          entry.environmentName,
          entry.title,
          entry.group,
          entry.disabled,
        ]),
    ).toEqual([
      ['Beelink', 'main', 'No review', false],
      ['MacBook', 'main', 'No review', true],
    ]);
    expect(
      new Set(registry.get(list).entries.map((entry) => entry.key)).size,
    ).toBe(2);
  } finally {
    stop();
  }
});

function inventoryAnswer(environmentId: string, index: number) {
  return {
    environmentId,
    environment: {
      name: index === 0 ? 'Beelink' : 'MacBook',
      custom: false,
    },
    projects: [
      {
        id: '30000000-0000-4000-8000-000000000001',
        name: 'Porcelain',
        available: true,
        worktrees: [
          {
            id: 'a'.repeat(32),
            path: '/code/main',
            main: true,
            branch: 'refs/heads/main',
            available: index === 0,
            status: null,
          },
        ],
      },
    ],
  };
}

it('retry recovers a failed project review read through the same connection', async () => {
  let fail = true;
  let reviewReads = 0;
  const client = create(
    (path) => {
      if (path.startsWith('/api/inventory'))
        return Promise.resolve(Response.json(inventoryAnswer(ids[0]!, 0)));
      reviewReads++;
      return Promise.resolve(
        fail
          ? new Response('Temporarily unavailable', { status: 503 })
          : Response.json([]),
      );
    },
    undefined,
    1000,
    ids[0],
  );
  const connections = [client.connection];
  const list = readReviewList(connections);
  const stop = client.registry.mount(list);
  try {
    await expect
      .poll(() => client.registry.get(list).messages)
      .toEqual(['Reviews for Porcelain could not be read.']);
    fail = false;
    client.registry.set(refreshReviewList(connections), undefined);
    await expect.poll(() => client.registry.get(list).messages).toEqual([]);
    expect(reviewReads).toBe(2);
    expect(client.registry.get(list).entries[0]?.title).toBe('main');
  } finally {
    stop();
  }
});
it('keeps a published review readable without enabling selection of its unavailable checkout', async () => {
  const reviewId = '40000000-0000-4000-8000-000000000001';
  const client = create(
    (path) =>
      Promise.resolve(
        Response.json(
          path.startsWith('/api/inventory')
            ? inventoryAnswer(ids[0]!, 1)
            : path.endsWith('/reviews')
              ? [
                  {
                    reviewId,
                    projectId: '30000000-0000-4000-8000-000000000001',
                    branch: 'main',
                    state: 'open',
                    latestRevision: 1,
                    lastSeenRevision: 0,
                  },
                ]
              : path.endsWith('/marks')
                ? { files: [], decisions: [] }
                : { review: null, revision: null, revisions: [] },
        ),
      ),
    undefined,
    1000,
    ids[0],
  );
  const list = readReviewList([client.connection]);
  const stop = client.registry.mount(list);
  try {
    await expect.poll(() => client.registry.get(list).loading).toBe(false);
    expect(client.registry.get(list).messages).toEqual([]);
    expect(client.registry.get(list).entries).toHaveLength(1);
    expect(client.registry.get(list).entries[0]).toMatchObject({
      reviewId,
      worktreeId: 'a'.repeat(32),
      title: 'main',
      disabled: true,
    });
  } finally {
    stop();
  }
});
