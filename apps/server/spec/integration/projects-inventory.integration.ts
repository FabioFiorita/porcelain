import * as Schema from 'effect/Schema';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect } from 'vitest';
import { eventually } from '../kit/reads.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

const inventory: HttpRequest = { method: 'GET', path: '/api/inventory' };

const everyProjectIs =
  (available: boolean) => (body: Record<string, unknown>) =>
    list(body.projects).every(
      (project) => record(project).available === available,
    );

const registered = (session: Session, available: boolean) => ({
  id: session.projectId,
  name: session.fixture.folders.repository,
  available,
  worktrees: [
    {
      id: session.worktreeId,
      path: session.repository,
      main: true,
      branch: `refs/heads/${session.fixture.branch}`,
      available,
      status: null,
    },
  ],
});

test('reading the inventory lists the registered project with its main worktree and is never cached', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: '/api/inventory',
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(readInventoryResponseSchema)),
    ),
  );
  expect(response.headers['cache-control']).toBe('no-store');
  expect(list(record(response.body).projects)).toStrictEqual([
    registered(session, true),
  ]);
});

test('a project whose folder has gone away stays registered as unavailable and is available again once the folder is back', async ({
  session,
}) => {
  const moved = `${session.repository}-moved`;
  await session.rename(session.repository, moved);
  try {
    await eventually(session, inventory, everyProjectIs(false));

    const response = await session.send({
      method: 'GET',
      path: '/api/inventory',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.schemaMatching(
        Schema.toStandardSchemaV1(
          Schema.toEncoded(readInventoryResponseSchema),
        ),
      ),
    );
    expect(list(record(response.body).projects)).toStrictEqual([
      { ...registered(session, false), unavailableReason: 'missing' },
    ]);
  } finally {
    await session.rename(moved, session.repository);
  }
  expect(
    list((await eventually(session, inventory, everyProjectIs(true))).projects),
  ).toStrictEqual([registered(session, true)]);
});

test('refreshing the inventory rechecks a missing repository and restores its original worktree when the folder returns', async ({
  session,
}) => {
  const moved = `${session.repository}-retry`;
  await session.rename(session.repository, moved);
  try {
    const missing = await session.send({
      method: 'POST',
      path: '/api/inventory/refresh',
    });
    expect(missing.status).toBe(200);
    expect(missing.headers['content-type']).toContain('application/json');
    expect(list(record(missing.body).projects)).toStrictEqual([
      { ...registered(session, false), unavailableReason: 'missing' },
    ]);
  } finally {
    await session.rename(moved, session.repository);
  }
  const recovered = await session.send({
    method: 'POST',
    path: '/api/inventory/refresh',
  });
  expect(recovered.status).toBe(200);
  expect(recovered.headers['content-type']).toContain('application/json');
  expect(list(record(recovered.body).projects)).toStrictEqual([
    registered(session, true),
  ]);
});

test('removing a moved project lets the replacement repository be registered', async ({
  session,
}) => {
  await session.rename(
    `${session.repository}/.git`,
    `${session.repository}-old-git`,
  );
  try {
    await session.git('init');
    const moved = await session.send({
      method: 'POST',
      path: '/api/inventory/refresh',
    });
    expect(moved.status).toBe(200);
    expect(list(record(moved.body).projects)).toStrictEqual([
      { ...registered(session, false), unavailableReason: 'moved' },
    ]);

    const removed = await session.send({
      method: 'DELETE',
      path: `/api/projects/${session.projectId}`,
    });
    expect(removed.status).toBe(200);
    expect(removed.body).toStrictEqual({ deleted: true });
    const readded = await session.send({
      method: 'POST',
      path: '/api/projects',
      body: { path: session.repository },
    });
    expect(readded.status).toBe(200);
    expect(readded.body).toMatchObject({
      name: session.fixture.folders.repository,
      available: true,
      worktrees: [{ path: session.repository, main: true, available: true }],
    });
    expect(
      list(record((await session.read(inventory)).body).projects),
    ).toStrictEqual([readded.body]);
  } finally {
    if ((await session.entries(session.repository)).includes('.git'))
      await session.rename(
        `${session.repository}/.git`,
        `${session.repository}-replacement-git`,
      );
    await session.rename(
      `${session.repository}-old-git`,
      `${session.repository}/.git`,
    );
  }
});
