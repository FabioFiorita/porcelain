import { filesApi } from '@porcelain/client/files/api';
import { runRequest } from '@porcelain/client/transport';
import { refreshFileEdit } from '@porcelain/client/files';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect } from 'vitest';
import { Effect } from 'effect';
import { AtomRegistry, type Atom, type AsyncResult } from 'effect/reactivity';
import { QueryClient } from '@tanstack/query-core';
import { test } from '@porcelain/server/kit/server-test';
import { readDirectory } from '@porcelain/client/files';
import { readWorktreePaths } from '@porcelain/client/files';
import { readTextFile } from '@porcelain/client/files';
import { connection } from '../kit/connection.ts';

const owned = new Set<AtomRegistry.AtomRegistry>();
afterEach(() => {
  for (const registry of owned) registry.dispose();
  owned.clear();
});
function reader() {
  const registry = AtomRegistry.make();
  owned.add(registry);
  return <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) =>
    Effect.runPromise(
      AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
    );
}

test('browse nested paths and read exact Unicode text through the paired transport', async ({
  server,
  session,
}) => {
  await mkdir(join(session.repository, 'notes'));
  await session.writeFile('notes/a #&?.md', 'Olá 🌿\nSecond line\n');
  const { connected, scope } = await connection(server, session);
  const read = reader();
  const root = await read(
    readDirectory({ scope, connection: connected, path: '' }),
  );
  expect(root.entries).toContainEqual({ name: 'notes', kind: 'directory' });
  const nested = await read(
    readDirectory({ scope, connection: connected, path: 'notes' }),
  );
  expect(nested).toEqual({
    worktreeId: scope.worktreeId,
    path: 'notes',
    entries: [{ name: 'a #&?.md', kind: 'file' }],
  });
  const paths = await read(readWorktreePaths({ scope, connection: connected }));
  expect(paths.paths).toContain('notes/a #&?.md');
  const file = await read(
    readTextFile({ scope, connection: connected, path: 'notes/a #&?.md' }),
  );
  expect(file).toMatchObject({
    worktreeId: scope.worktreeId,
    path: 'notes/a #&?.md',
    encoding: 'utf-8',
    byteLength: 22,
    text: 'Olá 🌿\nSecond line\n',
  });
});

test('missing files retain the server error and binary files explain why text is unavailable', async ({
  server,
  session,
}) => {
  await session.writeFile('binary.dat', new Uint8Array([0, 1, 2]));
  const { connected, scope } = await connection(server, session);
  const read = reader();
  await expect(
    read(readTextFile({ scope, connection: connected, path: 'missing.md' })),
  ).rejects.toMatchObject({
    _tag: 'PathNotFoundError',
    message: 'Path not found',
  });
  await expect(
    read(readTextFile({ scope, connection: connected, path: 'binary.dat' })),
  ).resolves.toEqual({
    kind: 'unreadable',
    reason: 'This file is binary or uses an unsupported text encoding.',
  });
});

test('save exact text through the shared writer and refuse an older fingerprint', async ({
  server,
  session,
}) => {
  const { connected, scope } = await connection(server, session);
  const read = reader();
  const original = await read(
    readTextFile({
      scope,
      connection: connected,
      path: session.fixture.readme.path,
    }),
  );
  if (!('contentFingerprint' in original) || !original.contentFingerprint)
    throw new Error('Expected the editable file fingerprint');
  const input = {
    kind: 'write' as const,
    path: session.fixture.readme.path,
    text: 'Saved by the shared client.\n',
    expectedFingerprint: original.contentFingerprint,
  };
  const saved = await runRequest(
    filesApi(connected).editFile({
      params: { worktreeId: scope.worktreeId },
      payload: input,
    }),
    connected.request().signal,
  );
  expect(saved.contentFingerprint).not.toBe(original.contentFingerprint);
  await runRequest(
    refreshFileEdit(new QueryClient(), connected, scope, input),
    connected.request().signal,
  );
  const current = await read(
    readTextFile({
      scope,
      connection: connected,
      path: session.fixture.readme.path,
    }),
  );
  expect(current).toMatchObject({
    text: 'Saved by the shared client.\n',
    contentFingerprint: saved.contentFingerprint,
  });
  await expect(
    runRequest(
      filesApi(connected).editFile({
        params: { worktreeId: scope.worktreeId },
        payload: { ...input, text: 'Overwrite with an old fingerprint.\n' },
      }),
      connected.request().signal,
    ),
  ).rejects.toMatchObject({
    _tag: 'ContentChangedError',
    message: 'Content changed; retry the operation',
  });
  expect(
    await read(
      readTextFile({
        scope,
        connection: connected,
        path: session.fixture.readme.path,
      }),
    ),
  ).toMatchObject({ text: 'Saved by the shared client.\n' });
});
