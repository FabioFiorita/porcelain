import * as Schema from 'effect/Schema';
import { DateTime } from 'effect';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect } from 'vite-plus/test';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eventually, watching } from '../kit/reads.ts';
import { read } from '../kit/requests.ts';
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

const readsUncommittedWork = (body: Record<string, unknown>) =>
  list(body.projects).every((project) =>
    list(record(project).worktrees).every(
      (worktree) => record(worktree).uncommittedChangedAt !== undefined,
    ),
  );

const registered = async (session: Session, available: boolean) => ({
  id: session.projectId,
  name: session.fixture.folders.repository,
  available,
  walkthroughSettings: { mode: 'manual' },
  worktrees: [
    {
      id: session.worktreeId,
      path: session.repository,
      main: true,
      branch: session.fixture.branch,
      available,
      ...(available
        ? {
            headCommittedAt: DateTime.formatIso(
              DateTime.makeUnsafe(
                (
                  await session.git('show', '-s', '--format=%cI', 'HEAD')
                ).trim(),
              ),
            ),
            uncommittedChangedAt: DateTime.formatIso(
              DateTime.makeUnsafe(
                Math.floor(
                  (
                    await stat(
                      join(session.repository, session.fixture.readme.path),
                    )
                  ).mtimeMs,
                ),
              ),
            ),
          }
        : {}),
    },
  ],
});

test('reading the inventory lists the registered project with its main worktree and is never cached', async ({
  session,
}) => {
  await read(session, { method: 'POST', path: '/api/inventory/refresh' });
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
    await registered(session, true),
  ]);
});

test('an uncommitted edit dates its worktree and live viewers hear it as uncommitted work only', async ({
  session,
}) => {
  const connection = await watching(session);
  const edited =
    DateTime.toEpochMillis(DateTime.makeUnsafe('2026-03-02T09:30:00.000Z')) /
    1000;
  await session.writeFile(
    session.fixture.readme.path,
    session.fixture.readme.changed,
  );
  await utimes(
    join(session.repository, session.fixture.readme.path),
    edited,
    edited,
  );

  const refreshed = await session.send({
    method: 'POST',
    path: '/api/inventory/refresh',
  });

  expect(refreshed.status).toBe(200);
  const [project] = list(record(refreshed.body).projects);
  expect(list(record(project).worktrees)).toStrictEqual([
    expect.objectContaining({
      id: session.worktreeId,
      uncommittedChangedAt: '2026-03-02T09:30:00.000Z',
    }),
  ]);
  expect(
    await connection.next((notice) => notice.type === 'inventory'),
  ).toStrictEqual({ type: 'inventory', change: 'activity' });
});

test('a failed status read keeps the worktree’s last uncommitted-change date until a later read succeeds', async ({
  session,
}) => {
  const edited =
    DateTime.toEpochMillis(DateTime.makeUnsafe('2026-04-05T06:07:08.000Z')) /
    1000;
  await utimes(
    join(session.repository, session.fixture.readme.path),
    edited,
    edited,
  );
  const changedAt = async () => {
    const response = await session.send({
      method: 'POST',
      path: '/api/inventory/refresh',
    });
    expect(response.status).toBe(200);
    const [project] = list(record(response.body).projects);
    const [worktree] = list(record(project).worktrees);
    return record(worktree).uncommittedChangedAt;
  };
  expect(await changedAt()).toBe('2026-04-05T06:07:08.000Z');
  const index = join(session.repository, '.git', 'index');
  const saved = await readFile(index);
  await writeFile(index, 'not an index');
  try {
    expect(await changedAt()).toBe('2026-04-05T06:07:08.000Z');
  } finally {
    await writeFile(index, saved);
  }
  expect(await changedAt()).toBe('2026-04-05T06:07:08.000Z');
});

test('a Git listing timeout keeps the project and its checkouts available until Git confirms a removal', async ({
  session,
}) => {
  const checkout = join(session.projectHome, 'linked');
  await session.git('worktree', 'add', '-b', 'linked', checkout);
  const refresh = { method: 'POST', path: '/api/inventory/refresh' } as const;
  const projects = async () => {
    const body = await read(session, refresh);
    return list(body.projects).map((entry) => {
      const project = record(entry);
      return {
        id: project.id,
        available: project.available,
        worktrees: list(project.worktrees).map((tree) => {
          const worktree = record(tree);
          return { path: worktree.path, available: worktree.available };
        }),
      };
    });
  };
  const main = { path: session.repository, available: true };
  const linked = { path: checkout, available: true };
  const project = { id: session.projectId, available: true };
  expect(await projects()).toEqual([{ ...project, worktrees: [main, linked] }]);

  const pending = join(session.repository, '.git', 'worktrees', 'pending');
  await mkdir(pending);
  try {
    execFileSync('mkfifo', [join(pending, 'gitdir')]);
    const during = await projects();
    const directory = await session.send({
      method: 'GET',
      path: `/api/worktrees/${session.worktreeId}/directory`,
      query: { path: '' },
    });
    expect({ during, directoryStatus: directory.status }).toEqual({
      during: [{ ...project, worktrees: [main, linked] }],
      directoryStatus: 200,
    });
  } finally {
    await rm(pending, { recursive: true, force: true });
  }

  await session.git('worktree', 'remove', checkout);
  expect(await projects()).toEqual([{ ...project, worktrees: [main] }]);
});

test('a retained worktree id cannot write to the repository that replaced its checkout', async ({
  session,
}) => {
  const checkout = join(session.projectHome, 'retained');
  const saved = join(session.projectHome, 'retained-saved');
  const pending = join(
    session.repository,
    '.git',
    'worktrees',
    'pending-write',
  );
  const refresh = { method: 'POST', path: '/api/inventory/refresh' } as const;
  const listed = async () =>
    list(record(list((await read(session, refresh)).projects)[0]).worktrees)
      .map(record)
      .find((worktree) => worktree.path === checkout);

  await session.git('worktree', 'add', '-b', 'retained', checkout);
  const original = await listed();
  const id = original?.id;
  if (typeof id !== 'string')
    throw new Error('The linked checkout was not listed');

  await mkdir(pending);
  try {
    execFileSync('mkfifo', [join(pending, 'gitdir')]);
    await session.rename(checkout, saved);
    try {
      await session.git('init', '-b', 'replacement', checkout);
      const before = await session.entries(checkout);
      expect(await listed()).toMatchObject({ id, available: true });
      const response = await session.send({
        method: 'POST',
        path: `/api/worktrees/${id}/files`,
        body: { kind: 'create', path: 'new.md', entryKind: 'file' },
      });
      expect({
        status: response.status,
        entries: await session.entries(checkout),
      }).toEqual({
        status: 409,
        entries: before,
      });
    } finally {
      await rm(checkout, { recursive: true, force: true });
      await session.rename(saved, checkout);
    }
  } finally {
    await rm(pending, { recursive: true, force: true });
    await session.git('worktree', 'remove', checkout);
    await read(session, refresh);
  }
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
      { ...(await registered(session, false)), unavailableReason: 'missing' },
    ]);
  } finally {
    await session.rename(moved, session.repository);
  }
  expect(
    list(
      (
        await eventually(
          session,
          inventory,
          (body) => everyProjectIs(true)(body) && readsUncommittedWork(body),
        )
      ).projects,
    ),
  ).toStrictEqual([await registered(session, true)]);
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
      { ...(await registered(session, false)), unavailableReason: 'missing' },
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
    await registered(session, true),
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
      { ...(await registered(session, false)), unavailableReason: 'moved' },
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
    ).toStrictEqual([
      {
        ...record(readded.body),
        walkthroughSettings: { mode: 'manual' },
      },
    ]);
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
