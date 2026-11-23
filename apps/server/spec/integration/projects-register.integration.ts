import { registerProjectResponseSchema } from '@porcelain/contracts/projects';
import * as Schema from 'effect/Schema';
import { expect } from 'vite-plus/test';
import { apiError } from '../kit/answers.ts';
import { worktreePath } from '../kit/requests.ts';
import { fingerprintOf, inventory } from '../kit/reads.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text } from '../kit/session.ts';

const byText = (left: string, right: string) => left.localeCompare(right);

test('registering a second repository names the project after its folder, lists its worktrees and adds it to the inventory', async ({
  session,
}) => {
  const path = `${session.projectHome}/second`;
  await session.git('init', '-b', 'trunk', path);

  const response = await session.send({
    method: 'POST',
    path: '/api/projects',
    body: { path },
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(registerProjectResponseSchema),
      ),
    ),
  );
  expect(response.body).toMatchObject({
    name: 'second',
    available: true,
    worktrees: [
      {
        path,
        main: true,
        branch: 'trunk',
        available: true,
      },
    ],
  });
  const projects = list((await inventory(session)).projects).map(
    (entry) => record(entry).id,
  );
  expect(projects.map(text).sort(byText)).toStrictEqual(
    [session.projectId, text(record(response.body).id)].sort(byText),
  );
});

test('registering an already registered repository returns the existing project instead of a duplicate', async ({
  session,
}) => {
  const response = await session.send({
    method: 'POST',
    path: '/api/projects',
    body: { path: session.repository },
  });

  expect(response.status).toBe(200);
  expect(record(response.body).id).toBe(session.projectId);
  expect(list((await inventory(session)).projects)).toHaveLength(2);
});

test('registering a missing folder or a folder that is not a repository cannot be inspected and changes nothing', async ({
  session,
}) => {
  const before = await inventory(session);

  const responses = [
    await session.send({
      method: 'POST',
      path: '/api/projects',
      body: { path: `${session.projectHome}/missing` },
    }),
    await session.send({
      method: 'POST',
      path: '/api/projects',
      body: { path: `${session.projectHome}/home` },
    }),
  ];

  expect(responses[0]?.status).toBe(422);
  expect(responses[0]?.body).toStrictEqual(
    apiError(
      422,
      'Unprocessable Entity',
      `The folder no longer exists: ${session.projectHome}/missing`,
    ),
  );
  expect(responses[1]?.status).toBe(422);
  expect(responses[1]?.body).toStrictEqual(
    apiError(
      422,
      'Unprocessable Entity',
      `Git could not inspect this folder. Check that it is a readable Git repository: ${session.projectHome}/home`,
    ),
  );
  expect(await inventory(session)).toStrictEqual(before);
});

test('reconnecting to a partial listing keeps the project and isolates the previous repository’s review marks', async ({
  session,
}) => {
  const before = await inventory(session);
  await session.read({
    method: 'PUT',
    path: worktreePath(session, '/reviewed'),
    body: {
      path: session.fixture.readme.path,
      reviewed: true,
      fingerprint: await fingerprintOf(session, session.fixture.readme.path),
    },
  });
  const originalMarks = await session.read({
    method: 'GET',
    path: worktreePath(session, '/reviewed'),
  });
  expect(list(record(originalMarks.body).marks).length).toBeGreaterThan(0);
  const savedGit = `${session.projectHome}/original-git`;
  await session.rename(`${session.repository}/.git`, savedGit);
  try {
    await session.git('init', '-b', 'replacement', session.repository);
    const offered = await session.send({
      method: 'POST',
      path: '/api/projects',
      body: { path: session.repository },
    });
    expect(offered.status).toBe(200);
    expect(offered.body).toMatchObject({
      id: session.projectId,
      available: false,
      unavailableReason: 'moved',
    });
    expect(list((await inventory(session)).projects)).toHaveLength(
      list(before.projects).length,
    );
    expect(
      (
        await session.send({
          method: 'GET',
          path: worktreePath(session, '/changes'),
        })
      ).status,
    ).toBe(422);
    await session.git('config', 'user.name', 'Fixture');
    await session.git('config', 'user.email', 'fixture@example.invalid');
    await session.git('commit', '--allow-empty', '-m', 'Replacement');
    const linked = `${session.projectHome}/unidentified`;
    await session.git('worktree', 'add', '-b', 'unidentified', linked);
    const admin = `${session.repository}/.git/worktrees/unidentified`;
    const externalAdmin = `${session.projectHome}/unidentified-git`;
    await session.rename(admin, externalAdmin);
    await session.symlink(externalAdmin, admin);
    expect(await session.git('worktree', 'list', '--porcelain')).toContain(
      `worktree ${linked}`,
    );

    const connected = await session.send({
      method: 'POST',
      path: '/api/projects',
      body: { path: session.repository, reconnectProjectId: session.projectId },
    });
    expect(connected.status).toBe(200);
    expect(connected.body).toMatchObject({
      id: session.projectId,
      available: true,
    });
    const replacement = record(list(record(connected.body).worktrees)[0]);
    expect(replacement.id).not.toBe(session.worktreeId);
    const newMarks = await session.read({
      method: 'GET',
      path: `/api/worktrees/${text(replacement.id)}/reviewed`,
    });
    expect(newMarks.body).toMatchObject({ marks: [] });
    const oldMarks = await session.send({
      method: 'GET',
      path: worktreePath(session, '/reviewed'),
    });
    expect({
      oldMarksStatus: oldMarks.status,
      worktreeIds: list(record(connected.body).worktrees).map(
        (worktree) => record(worktree).id,
      ),
    }).toEqual({ oldMarksStatus: 404, worktreeIds: [replacement.id] });
    expect(list((await inventory(session)).projects)).toHaveLength(
      list(before.projects).length,
    );
  } finally {
    await session.rename(
      `${session.repository}/.git`,
      `${session.projectHome}/replacement-git`,
    );
    await session.rename(savedGit, `${session.repository}/.git`);
    await session.read({ method: 'POST', path: '/api/inventory/refresh' });
    await session.read({
      method: 'POST',
      path: '/api/projects',
      body: { path: session.repository, reconnectProjectId: session.projectId },
    });
  }
  expect(
    (
      await session.read({
        method: 'GET',
        path: worktreePath(session, '/reviewed'),
      })
    ).body,
  ).toEqual(originalMarks.body);
});
