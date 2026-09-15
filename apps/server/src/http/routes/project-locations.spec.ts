import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  projectDiscoveryResponseSchema,
  projectFolderResponseSchema,
} from '@porcelain/contracts/inventory';
import { createIsolatedGit } from '@porcelain/git/fixtures/isolated-git';
import { expect, it } from 'vitest';
import { NodeProjectFolders } from '../../filesystem/project-folders.ts';
import { createServer } from '../server.ts';

const token = 'fixture-token-with-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };

it('finds unregistered repositories and browses folders without changing inventory or repositories', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-locations-')),
  );
  const home = join(root, 'home');
  const repository = join(home, 'code', 'new project');
  const outside = join(root, 'outside');
  const bin = await createIsolatedGit(root);
  const git = (...args: string[]) =>
    execFileSync(join(bin, 'git'), args, { encoding: 'utf8' });
  await mkdir(repository, { recursive: true });
  await mkdir(outside);
  git('init', '-b', 'main', repository);
  git(
    '-C',
    repository,
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '--allow-empty',
    '-m',
    'Initial',
  );
  const linked = join(home, 'linked');
  git('-C', repository, 'worktree', 'add', '-b', 'review', linked);
  for (const name of [
    'node_modules/dependency',
    '.hidden/private',
    'bad-marker',
  ]) {
    const path = join(home, name);
    await mkdir(path, { recursive: true });
    if (name === 'bad-marker') await writeFile(join(path, '.git'), 'invalid');
    else git('init', '-b', 'main', path);
  }
  git('init', '-b', 'main', outside);
  await symlink(outside, join(home, 'shortcut'));
  await symlink(home, join(home, 'loop'));
  await writeFile(join(home, 'plain.txt'), 'not a directory');
  const before = git('-C', repository, 'status', '--porcelain=v2');
  const server = await createServer({
    dataDirectory: join(root, 'state'),
    projectHome: home,
    token,
  });
  try {
    const initial = await server.inject({
      url: '/api/projects/folders',
      headers,
    });
    expect(initial.statusCode).toBe(200);
    const folder = projectFolderResponseSchema.parse(initial.json());
    expect(folder).toMatchObject({
      path: home,
      parent: root,
      repository: false,
      truncated: false,
    });
    expect(folder.directories.map((entry) => entry.name)).toEqual([
      '.hidden',
      'bad-marker',
      'code',
      'linked',
      'loop',
      'node_modules',
      'shortcut',
    ]);
    const listing = await server.inject({
      url: '/api/projects/discover',
      headers,
    });
    expect(listing.statusCode).toBe(200);
    const discovery = projectDiscoveryResponseSchema.parse(listing.json());
    // Main checkout and linked worktrees identify one project.
    expect(discovery.repositories).toHaveLength(1);
    expect([repository, linked]).toContain(discovery.repositories[0]?.path);
    expect(listing.headers['cache-control']).toBe('no-store');
    for (const path of [repository, linked, join(home, 'shortcut')]) {
      const response = await server.inject({
        url: `/api/projects/folders?${new URLSearchParams({ path })}`,
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ repository: true });
      expect(response.json().directories).not.toContainEqual(
        expect.objectContaining({ name: '.git' }),
      );
    }
    expect(
      (await server.inject({ url: '/api/inventory', headers })).json().projects,
    ).toEqual([]);
    expect(git('-C', repository, 'status', '--porcelain=v2')).toBe(before);
    const opened = await server.inject({
      method: 'POST',
      url: '/api/projects',
      headers,
      payload: { path: discovery.repositories[0]?.path },
    });
    expect(opened.statusCode).toBe(200);
    expect(opened.json().worktrees).toHaveLength(2);
    for (const [path, status] of [
      ['relative', 400],
      [join(home, 'missing'), 404],
      [join(home, 'plain.txt'), 422],
    ] as const) {
      const response = await server.inject({
        url: `/api/projects/folders?${new URLSearchParams({ path })}`,
        headers,
      });
      expect(response.statusCode).toBe(status);
      expect(response.body).not.toContain(home);
    }
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('authenticates and validates before reading any server folders', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-location-auth-'));
  let reads = 0;
  const server = await createServer({
    dataDirectory: root,
    projectHome: root,
    token,
    projectFolders: {
      async read() {
        reads++;
        throw new Error('private filesystem diagnostics');
      },
    },
  });
  try {
    for (const url of [
      '/projects/discover',
      '/api/projects/folders?path=relative',
    ]) {
      expect((await server.inject({ url })).statusCode).toBe(401);
    }
    for (const query of [
      'path=relative',
      'path=',
      'path=%00',
      'path=/&extra=1',
    ]) {
      expect(
        (
          await server.inject({
            url: `/api/projects/folders?${query}`,
            headers,
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(reads).toBe(0);
    const failed = await server.inject({
      url: '/api/projects/discover',
      headers,
    });
    expect(failed.statusCode).toBe(500);
    expect(failed.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Operation failed',
    });
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('bounds directory listings and honors cancellation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-folder-limit-'));
  try {
    await Promise.all(
      Array.from({ length: 2001 }, (_, index) =>
        mkdir(join(root, `folder-${index}`)),
      ),
    );
    const folders = new NodeProjectFolders();
    const result = await folders.read(root);
    expect(result.truncated).toBe(true);
    expect(result.directories).toHaveLength(2000);
    const controller = new AbortController();
    controller.abort();
    await expect(folders.read(root, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('cancels discovery when its browser request disconnects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-discovery-disconnect-'));
  const entered = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  const server = await createServer({
    dataDirectory: root,
    projectHome: root,
    token,
    projectFolders: {
      read: (_path, signal) =>
        new Promise((_resolve, reject) => {
          if (!signal) throw new Error('Missing cancellation');
          signal.addEventListener(
            'abort',
            () => {
              cancelled.resolve();
              reject(signal.reason);
            },
            { once: true },
          );
          entered.resolve();
        }),
    },
  });
  const controller = new AbortController();
  try {
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const response = fetch(`${address}/api/projects/discover`, {
      headers,
      signal: controller.signal,
    }).catch((error: unknown) => error);
    await entered.promise;
    controller.abort();
    await cancelled.promise;
    expect(await response).toMatchObject({ name: 'AbortError' });
  } finally {
    controller.abort();
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
