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
  await eventually(session, inventory, everyProjectIs(false));

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
  expect(list(record(response.body).projects)).toStrictEqual([
    registered(session, false),
  ]);
  await session.rename(moved, session.repository);
  expect(
    list((await eventually(session, inventory, everyProjectIs(true))).projects),
  ).toStrictEqual([registered(session, true)]);
});
