import { listFileCommitsResponseSchema } from '@porcelain/contracts/changes';
import * as Schema from 'effect/Schema';
import { expect } from 'vitest';
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
    nextAfter: null,
    boundary: null,
    restarted: false,
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
    nextAfter: { tip: rename, offset: 2 },
    boundary: null,
    restarted: false,
  });
  const first = Schema.decodeUnknownSync(listFileCommitsResponseSchema)(
    response.body,
  );
  const continued = await session.send(
    fileCommits(session, {
      path: 'GUIDE.md',
      limit: 2,
      after: JSON.stringify(first.nextAfter),
    }),
  );
  expect(continued.status).toBe(200);
  expect(continued.body).toMatchObject({
    commits: [{ path: session.fixture.readme.path, status: 'added' }],
    nextAfter: null,
    tip: rename,
    restarted: false,
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
    nextAfter: null,
    boundary: null,
    restarted: false,
  });
});

test('a path no commit touched has an empty timeline', async ({ session }) => {
  const response = await session.send(
    fileCommits(session, { path: 'never/written.md' }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    commits: [],
    nextAfter: null,
    boundary: null,
    restarted: false,
  });
});
