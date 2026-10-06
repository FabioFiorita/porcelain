import { expect } from 'vitest';
import { test } from '@porcelain/server/kit/server-test';
import { threeCommits } from '@porcelain/server/kit/reads';
import {
  readHistory,
  readHistoryWindow,
  readCommit,
  readFileTimeline,
} from '@porcelain/client/history';
import { readCommitDiffs } from '@porcelain/client/changes';
import { connection } from '../kit/connection.ts';

test('read commit metadata, renamed paths and the selected commit patch', async ({
  server,
  session,
}) => {
  const state = await threeCommits(session);
  const {
    connected,
    scope,
    read: nativeRead,
  } = await connection(server, session);
  const history = await nativeRead(
    readHistoryWindow({ scope, connection: connected }),
  );
  expect(history.commits.map((commit) => commit.subject)).toEqual([
    'Rename',
    'Second commit',
    'Initial commit',
  ]);
  const commit = await nativeRead(
    readCommit({ scope, connection: connected, oid: state.second }),
  );
  expect(commit).toMatchObject({
    commit: {
      oid: state.second,
      subject: 'Second commit',
      body: 'With a body',
    },
  });
  const diffs = await nativeRead(
    readCommitDiffs({
      scope,
      connection: connected,
      oid: state.second,
      parent: 1,
      paths: [[session.fixture.readme.path]],
    }),
  );
  expect(diffs).toEqual({
    commitOid: state.second,
    diffs: [
      {
        paths: [session.fixture.readme.path],
        content: {
          kind: 'text',
          patch: await session.git(
            'diff',
            state.initial,
            state.second,
            '--',
            session.fixture.readme.path,
          ),
        },
      },
    ],
  });
  const renamed = await nativeRead(
    readCommit({ scope, connection: connected, oid: state.rename }),
  );
  expect(renamed.files).toEqual([
    expect.objectContaining({
      status: 'renamed',
      oldPath: session.fixture.readme.path,
      newPath: 'GUIDE.md',
    }),
  ]);
  const timeline = await nativeRead(
    readFileTimeline({ scope, connection: connected, path: 'GUIDE.md' }),
  );
  expect(timeline.commits.map((entry) => entry.commit.subject)).toEqual([
    'Rename',
    'Second commit',
    'Initial commit',
  ]);
  expect(timeline.commits[0]).toMatchObject({
    path: 'GUIDE.md',
    previousPath: session.fixture.readme.path,
    status: 'renamed',
  });
});

test('read root, deleted, binary and empty commit changes without inventing a parent or a surviving path', async ({
  server,
  session,
}) => {
  const {
    connected,
    scope,
    read: nativeRead,
  } = await connection(server, session);
  const rootOid = (
    await session.git('rev-list', '--max-parents=0', 'HEAD')
  ).trim();
  const root = await nativeRead(
    readCommit({ scope, connection: connected, oid: rootOid }),
  );
  expect(root.comparison).toEqual({ kind: 'empty-tree' });
  expect(root.files).toContainEqual({
    oldPath: undefined,
    newPath: session.fixture.readme.path,
    status: 'added',
    oldMode: '000000',
    newMode: '100644',
  });
  const rootDiff = await nativeRead(
    readCommitDiffs({
      scope,
      connection: connected,
      oid: rootOid,
      parent: 1,
      paths: [[session.fixture.readme.path]],
    }),
  );
  expect(rootDiff).toEqual({
    commitOid: rootOid,
    diffs: [
      {
        paths: [session.fixture.readme.path],
        content: {
          kind: 'text',
          patch: await session.git(
            'show',
            '--format=',
            rootOid,
            '--',
            session.fixture.readme.path,
          ),
        },
      },
    ],
  });
  await session.git('reset', '--hard', rootOid);
  await session.remove(session.fixture.readme.path);
  await session.writeFile('image.bin', new Uint8Array([0, 1, 2, 3]));
  await session.git('add', '-A');
  await session.git('commit', '-m', 'Delete readme and add binary');
  const oid = (await session.git('rev-parse', 'HEAD')).trim();
  const changed = await nativeRead(
    readCommit({ scope, connection: connected, oid }),
  );
  expect(changed.files).toEqual([
    {
      oldPath: session.fixture.readme.path,
      newPath: undefined,
      status: 'deleted',
      oldMode: '100644',
      newMode: '000000',
    },
    {
      oldPath: undefined,
      newPath: 'image.bin',
      status: 'added',
      oldMode: '000000',
      newMode: '100644',
    },
  ]);
  const diffs = await nativeRead(
    readCommitDiffs({
      scope,
      connection: connected,
      oid,
      parent: 1,
      paths: [[session.fixture.readme.path], ['image.bin']],
    }),
  );
  expect(diffs).toEqual({
    commitOid: oid,
    diffs: [
      {
        paths: [session.fixture.readme.path],
        content: {
          kind: 'text',
          patch: await session.git(
            'diff',
            `${oid}^`,
            oid,
            '--',
            session.fixture.readme.path,
          ),
        },
      },
      { paths: ['image.bin'], content: { kind: 'binary' } },
    ],
  });
  await session.git('commit', '--allow-empty', '-m', 'Empty commit');
  const emptyOid = (await session.git('rev-parse', 'HEAD')).trim();
  const empty = await nativeRead(
    readCommit({ scope, connection: connected, oid: emptyOid }),
  );
  expect(empty.commit.subject).toBe('Empty commit');
  expect(empty.files).toEqual([]);
});

test('compare a merge with the chosen parent and cache each parent independently', async ({
  server,
  session,
}) => {
  await session.git('reset', '--hard', 'HEAD');
  await session.git('checkout', '-b', 'topic');
  await session.writeFile('TOPIC.md', 'topic change\n');
  await session.git('add', 'TOPIC.md');
  await session.git('commit', '-m', 'Topic change');
  const topic = (await session.git('rev-parse', 'HEAD')).trim();
  await session.git('checkout', session.fixture.branch);
  await session.writeFile('MAIN.md', 'main change\n');
  await session.git('add', 'MAIN.md');
  await session.git('commit', '-m', 'Main change');
  const main = (await session.git('rev-parse', 'HEAD')).trim();
  await session.git('merge', '--no-ff', 'topic', '-m', 'Merge topic');
  const oid = (await session.git('rev-parse', 'HEAD')).trim();
  const {
    connected,
    scope,
    read: nativeRead,
  } = await connection(server, session);
  const first = await nativeRead(
    readCommit({ scope, connection: connected, oid, parent: 1 }),
  );
  const second = await nativeRead(
    readCommit({ scope, connection: connected, oid, parent: 2 }),
  );
  expect(first.commit.parentOids).toEqual([main, topic]);
  expect(first.comparison).toEqual({
    kind: 'parent',
    parentNumber: 1,
    baseOid: main,
  });
  expect(first.files.map((file) => file.newPath)).toEqual(['TOPIC.md']);
  expect(second.comparison).toEqual({
    kind: 'parent',
    parentNumber: 2,
    baseOid: topic,
  });
  expect(second.files.map((file) => file.newPath)).toEqual(['MAIN.md']);
  const diff = await nativeRead(
    readCommitDiffs({
      scope,
      connection: connected,
      oid,
      parent: 2,
      paths: [['MAIN.md']],
    }),
  );
  expect(diff).toEqual({
    commitOid: oid,
    diffs: [
      {
        paths: ['MAIN.md'],
        content: {
          kind: 'text',
          patch: await session.git('diff', topic, oid, '--', 'MAIN.md'),
        },
      },
    ],
  });
  expect(
    await nativeRead(
      readCommit({ scope, connection: connected, oid, parent: 1 }),
    ),
  ).toEqual(first);
});

test('continue history with its tip and frontier and discard earlier pages after a restart', async ({
  server,
  session,
}) => {
  await session.git('checkout', '--orphan', 'paginated');
  await session.git('commit', '-am', 'History root');
  for (let index = 0; index < 100; index += 1)
    await session.git('commit', '--allow-empty', '-m', `Commit ${index}`);
  const {
    connected,
    scope,
    registry,
    read: nativeRead,
  } = await connection(server, session);
  const history = readHistory({ scope, connection: connected });
  const stop = registry.mount(history);
  const first = await nativeRead(
    readHistoryWindow({ scope, connection: connected }),
  );
  expect(first.commits).toHaveLength(50);
  expect(first.nextAfter).toBeDefined();
  registry.set(history, undefined);
  const next = await nativeRead(
    readHistoryWindow({ scope, connection: connected }),
  );
  expect(next.commits).toHaveLength(100);
  expect(next.commits.at(-1)?.subject).toBe('Commit 0');
  expect(next.nextAfter).toBeDefined();
  await session.git('checkout', '--orphan', 'replacement');
  await session.git('commit', '-am', 'Replacement history');
  registry.set(history, undefined);
  const restarted = await nativeRead(
    readHistoryWindow({ scope, connection: connected }),
  );
  expect(restarted.restarted).toBe(true);
  expect(restarted.commits.map((commit) => commit.subject)).toEqual([
    'Replacement history',
  ]);
  stop();
});
