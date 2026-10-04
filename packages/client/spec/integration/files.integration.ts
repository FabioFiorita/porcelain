import { editFile, refreshFileEdit } from '@porcelain/client/files';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { test } from '@porcelain/server/kit/server-test';
import { directoryQueryOptions } from '@porcelain/client/files';
import { pathsQueryOptions } from '@porcelain/client/files';
import { textQueryOptions } from '@porcelain/client/files';
import { inventoryQueryOptions } from '@porcelain/client/projects';
import { TEXT_BYTES } from '@porcelain/contracts/shared';
import { connection } from '../kit/connection.ts';

test('browse nested paths and read exact Unicode text through the paired transport', async ({
  server,
  session,
}) => {
  await mkdir(join(session.repository, 'notes'));
  await session.writeFile('notes/a #&?.md', 'Olá 🌿\nSecond line\n');
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  const root = await cache.query(directoryQueryOptions(scope, connected, ''));
  expect(root.entries).toContainEqual({ name: 'notes', kind: 'directory' });
  const nested = await cache.query(
    directoryQueryOptions(scope, connected, 'notes'),
  );
  expect(nested).toEqual({
    worktreeId: scope.worktreeId,
    path: 'notes',
    entries: [{ name: 'a #&?.md', kind: 'file' }],
  });
  const paths = await cache.query(pathsQueryOptions(scope, connected));
  expect(paths.paths).toContain('notes/a #&?.md');
  const file = await cache.query(
    textQueryOptions(scope, connected, 'notes/a #&?.md'),
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
  const cache = new QueryClient();
  await expect(
    cache.query({
      ...textQueryOptions(scope, connected, 'missing.md'),
      retry: false,
    }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    cache.query({
      ...textQueryOptions(scope, connected, 'binary.dat'),
      retry: false,
    }),
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
  const cache = new QueryClient();
  const original = await cache.query(
    textQueryOptions(scope, connected, session.fixture.readme.path),
  );
  if (!('contentFingerprint' in original) || !original.contentFingerprint)
    throw new Error('Expected the editable file fingerprint');
  const input = {
    kind: 'write' as const,
    path: session.fixture.readme.path,
    text: 'Saved by the shared client.\n',
    expectedFingerprint: original.contentFingerprint,
  };
  const saved = await editFile(
    connected,
    scope,
    input,
    connected.request().signal,
  );
  expect(saved.contentFingerprint).not.toBe(original.contentFingerprint);
  await refreshFileEdit(cache, connected, scope, input);
  const current = await cache.query(
    textQueryOptions(scope, connected, session.fixture.readme.path),
  );
  expect(current).toMatchObject({
    text: 'Saved by the shared client.\n',
    contentFingerprint: saved.contentFingerprint,
  });
  await expect(
    editFile(
      connected,
      scope,
      { ...input, text: 'Overwrite with an old fingerprint.\n' },
      connected.request().signal,
    ),
  ).rejects.toMatchObject({ status: 409, code: 'content_changed' });
  expect(
    await cache.query(
      textQueryOptions(scope, connected, session.fixture.readme.path),
    ),
  ).toMatchObject({ text: 'Saved by the shared client.\n' });
});

test('oversized files explain why their text cannot be displayed', async ({
  server,
  session,
}) => {
  await session.writeFile('large.txt', 'x'.repeat(TEXT_BYTES + 1));
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  expect(
    await cache.query(textQueryOptions(scope, connected, 'large.txt')),
  ).toEqual({
    kind: 'unreadable',
    reason: 'This file is too large to display as text.',
  });
});

test('rereading follows disk changes, reports deletion and recovers after restoration', async ({
  server,
  session,
}) => {
  await session.writeFile('changing.ts', 'const value = "first";\n');
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  const options = {
    ...textQueryOptions(scope, connected, 'changing.ts'),
    retry: false,
  };
  expect(await cache.query(options)).toMatchObject({
    text: 'const value = "first";\n',
  });
  await session.writeFile('changing.ts', 'const value = "second";\n');
  expect(await cache.query(options)).toMatchObject({
    text: 'const value = "second";\n',
  });
  await session.remove('changing.ts');
  await expect(cache.query(options)).rejects.toMatchObject({
    status: 404,
    message: 'Path not found',
  });
  await session.writeFile('changing.ts', 'const value = "restored";\n');
  expect(await cache.query(options)).toMatchObject({
    text: 'const value = "restored";\n',
  });
});

test("a removed worktree fails its next read instead of returning another worktree's text", async ({
  server,
  session,
}) => {
  const folder = join(session.projectHome, 'files-worktree');
  await session.git('worktree', 'add', '-b', 'files-worktree', folder);
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  await expect
    .poll(async () =>
      (await cache.query(inventoryQueryOptions(connected))).projects
        .find((project) => project.id === scope.projectId)
        ?.worktrees.some((candidate) => candidate.path === folder),
    )
    .toBe(true);
  const inventory = await cache.query(inventoryQueryOptions(connected));
  const worktree = inventory.projects
    .find((project) => project.id === scope.projectId)
    ?.worktrees.find(
      (candidate) => candidate.branch === 'refs/heads/files-worktree',
    );
  if (!worktree)
    throw new Error('The linked worktree is missing from the inventory');
  const selected = { ...scope, worktreeId: worktree.id };
  const options = {
    ...textQueryOptions(selected, connected, session.fixture.readme.path),
    retry: false,
  };
  expect(await cache.query(options)).toMatchObject({
    text: session.fixture.readme.committed,
  });
  await session.git('worktree', 'remove', folder);
  await expect(cache.query(options)).rejects.toMatchObject({
    status: 422,
    message: 'Repository could not be inspected',
  });
});
