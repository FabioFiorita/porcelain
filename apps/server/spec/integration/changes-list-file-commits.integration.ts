import * as Schema from 'effect/Schema';
import { listFileCommitsResponseSchema } from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import {
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { threeCommits } from '../kit/reads.ts';
import { read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import type { HttpRequest, Session } from '../kit/session.ts';

function fileCommits(
  session: Session,
  query: Record<string, string | number>,
): HttpRequest {
  return {
    method: 'GET',
    path: worktreePath(session, '/file-commits'),
    query,
  };
}

test('the timeline of a file follows it back across its rename, newest first', async ({
  session,
}) => {
  const state = await threeCommits(session);

  const response = await session.send(
    fileCommits(session, { path: 'GUIDE.md' }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(listFileCommitsResponseSchema),
      ),
    ),
  );
  const readme = session.fixture.readme.path;
  expect(response.body).toMatchObject({
    commits: [
      {
        commit: { oid: state.rename, subject: 'Rename' },
        path: 'GUIDE.md',
        previousPath: readme,
        status: 'renamed',
      },
      {
        commit: { oid: state.second, subject: 'Second commit' },
        path: readme,
        previousPath: null,
        status: 'modified',
      },
      {
        commit: {
          oid: state.initial,
          subject: session.fixture.initialCommit,
        },
        path: readme,
        previousPath: null,
        status: 'added',
      },
    ],
    more: false,
  });
});

test('a limit keeps the newest commits of the timeline and says older ones exist', async ({
  session,
}) => {
  const response = await session.send(
    fileCommits(session, { path: 'GUIDE.md', limit: 2 }),
  );

  expect(response.status).toBe(200);
  const [rename, second] = (await session.git('rev-list', 'HEAD'))
    .trim()
    .split('\n');
  expect(response.body).toMatchObject({
    commits: [{ commit: { oid: rename } }, { commit: { oid: second } }],
    more: true,
  });
});

test('the timeline of a file that replaced a folder of the same name ends at the commit that added the file', async ({
  session,
}) => {
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/files'),
    body: { kind: 'create', path: 'cfg', entryKind: 'directory' },
  });
  await session.writeFile('cfg/a.txt', 'a\n');
  await session.git('add', 'cfg');
  await session.git('commit', '-m', 'Add a cfg folder');
  await session.rename(
    `${session.repository}/cfg`,
    `${session.repository}/old-cfg`,
  );
  await session.writeFile('cfg', 'setting = 1\n');
  await session.git('add', 'cfg');
  await session.git('commit', '-m', 'Replace the folder with a file');
  const added = (await session.git('rev-parse', 'HEAD')).trim();

  const response = await session.send(fileCommits(session, { path: 'cfg' }));

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    commits: [{ commit: { oid: added }, path: 'cfg', status: 'added' }],
    more: false,
  });
});

test('a path no commit touched has an empty timeline', async ({ session }) => {
  const response = await session.send(
    fileCommits(session, { path: 'never/written.md' }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ commits: [], more: false });
});

test('a timeline for a path outside the worktree or with an invalid limit is refused, and an unknown worktree is not found', async ({
  session,
}) => {
  const responses = [
    await session.send(fileCommits(session, { path: '../outside.md' })),
    await session.send(fileCommits(session, { path: 'GUIDE.md', limit: 0 })),
    await session.send({
      method: 'GET',
      path: `/api/worktrees/${unknownWorktreeId}/file-commits`,
      query: { path: 'GUIDE.md' },
    }),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([400, 400, 404]);
  expect(responses[0]?.body).toStrictEqual(invalidRequest);
  expect(responses[1]?.body).toStrictEqual(invalidRequest);
  expect(responses[2]?.body).toStrictEqual(worktreeNotFound);
});
