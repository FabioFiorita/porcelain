import { expect } from 'vitest';
import { test } from '@porcelain/server/kit/server-test';
import {
  readChangeDiffs,
  readChanges,
  readReviewedFiles,
  reviewedCommands,
} from '@porcelain/client/changes';
import { connection } from '../kit/connection.ts';
test('read changes and the exact Git patch, and refuse a stale diff snapshot', async ({
  server,
  session,
}) => {
  await session.writeFile(
    session.fixture.readme.path,
    `${session.fixture.readme.changed}A new uncommitted line.\n`,
  );
  const {
    connected,
    scope,
    read: nativeRead,
  } = await connection(server, session);
  const changes = await nativeRead(
    readChanges({ scope, connection: connected }),
  );
  expect(changes.changes).toHaveLength(1);
  const file = changes.changes[0];
  if (!file) throw new Error('Expected the changed readme');
  expect(file.path).toBe(session.fixture.readme.path);
  const input = {
    expectedStatusToken: changes.statusToken,
    expectedFiles: [{ path: file.path, fingerprint: file.fingerprint }],
    selections: [
      { scope: 'unstaged' as const, oldPath: file.path, newPath: file.path },
    ],
  };
  const diffs = await nativeRead(
    readChangeDiffs({ scope, connection: connected, input }),
  );
  expect(diffs.diffs).toEqual([
    {
      selection: input.selections[0],
      content: {
        kind: 'text',
        patch: await session.git('diff', '--', file.path),
      },
    },
  ]);
  await session.writeFile(file.path, 'A newer change\n');
  await expect(
    nativeRead(readChangeDiffs({ scope, connection: connected, input })),
  ).rejects.toMatchObject({
    _tag: 'WorktreeChangedError',
    message: 'Worktree changed during inspection',
  });
});

test('mark and unmark the actual changed file through the shared reviewed owner', async ({
  server,
  session,
}) => {
  const {
    connected,
    scope,
    read: nativeRead,
    execute,
  } = await connection(server, session);
  const changes = await nativeRead(
    readChanges({ scope, connection: connected }),
  );
  const file = changes.changes[0];
  if (!file?.fingerprint)
    throw new Error('Expected the changed file fingerprint');
  const commands = reviewedCommands({
    scope,
    connection: connected,
    range: { kind: 'worktree' },
  });
  await nativeRead(readReviewedFiles({ scope, connection: connected }));
  expect(
    (
      await execute(commands.set, {
        path: file.path,
        fingerprint: file.fingerprint,
      })
    ).marks.map((mark) => mark.path),
  ).toEqual([session.fixture.readme.path]);
  expect(
    (
      await nativeRead(readReviewedFiles({ scope, connection: connected }))
    ).marks.map((mark) => mark.path),
  ).toEqual([session.fixture.readme.path]);
  expect((await execute(commands.remove, file.path)).marks).toEqual([]);
  expect(
    (await nativeRead(readReviewedFiles({ scope, connection: connected })))
      .marks,
  ).toEqual([]);
});
