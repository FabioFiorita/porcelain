import { listCommitsResponseSchema } from '@porcelain/contracts/changes';
import * as Schema from 'effect/Schema';
import { expect } from 'vitest';
import { unknownOid } from '../kit/answers.ts';
import { threeCommits } from '../kit/reads.ts';
import { read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

function commits(
  session: Session,
  query?: Record<string, string | number>,
): HttpRequest {
  return {
    method: 'GET',
    path: worktreePath(session, '/commits'),
    ...(query ? { query } : {}),
  };
}

const author = {
  name: 'Porcelain Verification',
  timestamp: '2026-01-01T00:00:00.000Z',
};

test('the first page of history snapshots the head and returns the newest commit with the cursor for the next', async ({
  session,
}) => {
  const state = await threeCommits(session);

  const response = await session.send(commits(session, { limit: 1 }));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(listCommitsResponseSchema)),
    ),
  );
  expect(response.body).toStrictEqual({
    snapshot: {
      tipOid: state.rename,
      head: {
        kind: 'attached',
        ref: `refs/heads/${session.fixture.branch}`,
      },
    },
    commits: [
      {
        oid: state.rename,
        parentOids: [state.second],
        author,
        subject: 'Rename',
        subjectTruncated: false,
        body: null,
        bodyTruncated: false,
        refs: [
          { kind: 'head', name: 'HEAD' },
          { kind: 'local-branch', name: session.fixture.branch },
        ],
      },
    ],
    nextAfter: [state.second],
    tip: state.rename,
    boundary: null,
    restarted: false,
  });
});

test('continuing from the cursor returns the older commits from the same tip and ends the history', async ({
  session,
}) => {
  const first = await read(session, commits(session, { limit: 1 }));

  const response = await session.send(
    commits(session, {
      limit: 2,
      after: list(first.nextAfter).join(','),
      tip: String(first.tip),
    }),
  );

  expect(response.status).toBe(200);
  const body = record(response.body);
  expect(body.snapshot).toBe(null);
  expect(body.tip).toBe(first.tip);
  expect(body.commits).toMatchObject([
    { subject: 'Second commit', body: 'With a body' },
    { subject: session.fixture.initialCommit, parentOids: [] },
  ]);
  expect(body.nextAfter).toBe(null);
});

test('continuing from a tip that is no longer the snapshot restarts the listing from the current head', async ({
  session,
}) => {
  const first = await read(session, commits(session, { limit: 1 }));

  const response = await session.send(
    commits(session, {
      limit: 1,
      after: list(first.nextAfter).join(','),
      tip: unknownOid,
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    restarted: true,
    tip: first.tip,
    commits: [{ subject: 'Rename' }],
  });
});

test('large merge history continues in Git order without losing a parent or repeating a commit', async ({
  session,
}) => {
  await session.git('add', '-A');
  await session.git(
    'commit',
    '--allow-empty',
    '-m',
    'Prepare the merge history',
  );
  await session.git('switch', '-c', 'history-side');
  for (let index = 1; index <= 55; index++)
    await session.git('commit', '--allow-empty', '-m', `Side ${index}`);
  await session.git('switch', session.fixture.branch);
  for (let index = 1; index <= 55; index++)
    await session.git('commit', '--allow-empty', '-m', `Main ${index}`);
  await session.git(
    'merge',
    '--no-ff',
    '-m',
    'Join both histories',
    'history-side',
  );
  const merge = (await session.git('rev-parse', 'HEAD')).trim();
  const parents = (await session.git('show', '-s', '--format=%P', merge))
    .trim()
    .split(' ');
  for (let index = 1; index <= 10; index++)
    await session.git('commit', '--allow-empty', '-m', `After merge ${index}`);
  const expected = (
    await session.git('log', '--topo-order', '--format=%H', 'HEAD')
  )
    .trim()
    .split('\n');
  const first = await read(session, commits(session, { limit: 100 }));
  const second = await read(
    session,
    commits(session, {
      limit: 100,
      after: list(first.nextAfter).join(','),
      tip: String(first.tip),
    }),
  );
  const entries = [...list(first.commits), ...list(second.commits)].map(record);
  expect(list(first.commits)).toHaveLength(100);
  expect(entries.map((entry) => entry.oid)).toEqual(expected);
  expect(new Set(entries.map((entry) => entry.oid)).size).toBe(expected.length);
  expect(entries.find((entry) => entry.oid === merge)?.parentOids).toEqual(
    parents,
  );
  expect(second.nextAfter).toBeNull();
  expect(second.boundary).toBeNull();
});

test('complete ancestry does not inherit an unrelated shallow boundary', async ({
  session,
}) => {
  await session.git('add', '-A');
  await session.git(
    'commit',
    '--allow-empty',
    '-m',
    'Prepare complete ancestry',
  );
  const tip = (await session.git('rev-parse', 'HEAD')).trim();
  await session.git('switch', '--orphan', 'unrelated-shallow');
  await session.git('commit', '--allow-empty', '-m', 'Other shallow history');
  const boundary = (await session.git('rev-parse', 'HEAD')).trim();
  await session.git('switch', session.fixture.branch);
  await session.writeFile('.git/shallow', `${boundary}\n`);
  let page = await read(session, commits(session, { limit: 100 }));
  expect(page.tip).toBe(tip);
  while (page.nextAfter !== null)
    page = await read(
      session,
      commits(session, {
        limit: 100,
        after: list(page.nextAfter).join(','),
        tip,
      }),
    );
  expect(page.boundary).toBeNull();
});

test('a shallow merge side encountered on an earlier page still marks the final boundary', async ({
  session,
}) => {
  const tree = (await session.git('rev-parse', 'HEAD^{tree}')).trim();
  const shallow = (
    await session.git('commit-tree', tree, '-m', 'Short shallow side')
  ).trim();
  await session.writeFile('.git/shallow', `${shallow}\n`);
  for (let index = 1; index <= 5; index++)
    await session.git(
      'commit',
      '--allow-empty',
      '-m',
      `Complete side ${index}`,
    );
  await session.git(
    'merge',
    '--allow-unrelated-histories',
    '--no-ff',
    '-m',
    'Join short shallow side',
    shallow,
  );
  const tip = (await session.git('rev-parse', 'HEAD')).trim();
  const expected = (
    await session.git('log', '--topo-order', '--format=%H', tip)
  )
    .trim()
    .split('\n');
  expect(expected.indexOf(shallow)).toBeLessThan(20);
  let page = await read(session, commits(session, { limit: 20 }));
  const shown = list(page.commits).map((entry) => record(entry).oid);
  expect(shown).toContain(shallow);
  expect(page.nextAfter).not.toBeNull();
  while (page.nextAfter !== null) {
    page = await read(
      session,
      commits(session, {
        limit: 20,
        after: list(page.nextAfter).join(','),
        tip,
      }),
    );
    shown.push(...list(page.commits).map((entry) => record(entry).oid));
  }
  expect(shown).toEqual(expected);
  expect(page.boundary).toBe('shallow');
});
