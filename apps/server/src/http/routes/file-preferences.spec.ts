import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { expect, it } from 'vitest';
import { openDatabase } from '../../db/connection.ts';
import { FilePreferenceRepository } from '../../repositories/file-preference-repository.ts';
import { createServer } from '../server.ts';

const token = 'fixture-token-with-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };

it('persists independent file and folder intent through retry, refresh, unavailable checkout and restart over HTTP', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-preferences-')),
  );
  const path = join(root, 'project');
  const dataDirectory = join(root, 'state');
  await mkdir(path);
  execFileSync('git', ['init', '-b', 'main', path]);
  const server = await createServer({ dataDirectory, token });
  try {
    const registered = await server.inject({
      method: 'POST',
      url: '/projects',
      headers,
      payload: { path },
    });
    const project = projectResponseSchema.parse(registered.json());
    const id = project.id;
    const url = `/projects/${id}/file-preferences`;
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const set = async (
      filePath: string,
      flag: 'pinned' | 'hidden',
      value: boolean,
    ) => {
      const response = await fetch(`${address}${url}`, {
        method: 'PUT',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ path: filePath, flag, value }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      return response.json();
    };
    expect(await set('z-absent.ts', 'pinned', true)).toEqual({
      preferences: [{ path: 'z-absent.ts', pinned: true, hidden: false }],
    });
    await set('z-absent.ts', 'hidden', true);
    await set('z-absent.ts', 'pinned', true);
    await set('folder', 'hidden', true);
    expect(await set('z-absent.ts', 'pinned', false)).toEqual({
      preferences: [
        { path: 'folder', pinned: false, hidden: true },
        { path: 'z-absent.ts', pinned: false, hidden: true },
      ],
    });
    const expected = {
      preferences: [{ path: 'folder', pinned: false, hidden: true }],
    };
    expect(await set('z-absent.ts', 'hidden', false)).toEqual(expected);
    expect(await set('z-absent.ts', 'hidden', false)).toEqual(expected);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/inventory/refresh',
          headers,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await server.inject({ method: 'GET', url, headers })).json(),
    ).toEqual(expected);
    for (const accepted of [
      'notes:today.txt',
      'folder/notes:today.txt',
      'x'.repeat(4096),
    ]) {
      expect(await set(accepted, 'pinned', true)).toEqual({
        preferences: [
          ...expected.preferences,
          { path: accepted, pinned: true, hidden: false },
        ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
      });
      expect(await set(accepted, 'pinned', false)).toEqual(expected);
    }
    await rename(path, join(root, 'moved'));
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/inventory/refresh',
          headers,
        })
      ).statusCode,
    ).toBe(200);
    await set('absent/child.ts', 'pinned', true);
    await server.close();
    const reopened = await createServer({ dataDirectory, token });
    try {
      expect(
        (await reopened.inject({ method: 'GET', url, headers })).json(),
      ).toEqual({
        preferences: [
          { path: 'absent/child.ts', pinned: true, hidden: false },
          ...expected.preferences,
        ],
      });
    } finally {
      await reopened.close();
    }
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('isolates projects and rejects unauthenticated, noncanonical, unknown identity and bulk requests safely', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-preference-input-')),
  );
  const server = await createServer({
    dataDirectory: join(root, 'state'),
    token,
  });
  try {
    const ids: string[] = [];
    for (const name of ['one', 'two']) {
      const path = join(root, name);
      await mkdir(path);
      execFileSync('git', ['init', '-b', 'main', path]);
      const response = await server.inject({
        method: 'POST',
        url: '/projects',
        headers,
        payload: { path },
      });
      const project = projectResponseSchema.parse(response.json());
      ids.push(project.id);
    }
    const url = `/projects/${ids[0]}/file-preferences`;
    const payload = { path: 'file.ts', flag: 'pinned', value: true };
    expect(
      (await server.inject({ method: 'PUT', url, payload: { invalid: true } }))
        .statusCode,
    ).toBe(401);
    expect((await server.inject({ method: 'GET', url })).statusCode).toBe(401);
    expect(
      (await server.inject({ method: 'PUT', url, headers, payload }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await server.inject({
          method: 'GET',
          url: `/projects/${ids[1]}/file-preferences`,
          headers,
        })
      ).json(),
    ).toEqual({ preferences: [] });
    for (const path of [
      '',
      '/absolute',
      '../up',
      'x/../y',
      'x/./y',
      'x//y',
      'x/',
      'C:/file',
      'c:relative',
      'x'.repeat(4097),
      '\\file',
      'x\0y',
      '.git',
      'x/.GIT/config',
    ]) {
      const response = await server.inject({
        method: 'PUT',
        url,
        headers,
        payload: { ...payload, path },
      });
      expect(response.statusCode, path).toBe(400);
      expect(response.json()).toEqual({
        code: 'INVALID_REQUEST',
        message: 'Invalid request',
      });
    }
    for (const invalid of [
      { preferences: [] },
      { ...payload, other: true },
      { ...payload, value: 'true' },
      { ...payload, flag: 'order' },
    ]) {
      expect(
        (await server.inject({ method: 'PUT', url, headers, payload: invalid }))
          .statusCode,
      ).toBe(400);
    }
    for (const method of ['GET', 'PUT'] as const) {
      const response = await server.inject({
        method,
        url: '/projects/00000000-0000-4000-8000-000000000000/file-preferences',
        headers,
        ...(method === 'PUT' ? { payload } : {}),
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
      });
    }
    expect(
      (await server.inject({ method: 'GET', url, headers })).json(),
    ).toEqual({
      preferences: [{ path: 'file.ts', pinned: true, hidden: false }],
    });
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('returns a safe capacity conflict and permits clearing then adding through HTTP', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-preference-capacity-')),
  );
  const dataDirectory = join(root, 'state');
  const path = join(root, 'project');
  await mkdir(path);
  execFileSync('git', ['init', '-b', 'main', path]);
  const initial = await createServer({ dataDirectory, token });
  try {
    const registered = await initial.inject({
      method: 'POST',
      url: '/projects',
      headers,
      payload: { path },
    });
    const projectId = projectResponseSchema.parse(registered.json()).id;
    if (!projectId) throw new Error('Missing fixture worktree');
    await initial.close();
    const database = openDatabase(dataDirectory);
    try {
      const store = new FilePreferenceRepository(database.db);
      for (const index of Array.from({ length: 2000 }, (_, index) => index)) {
        store.set(projectId, {
          path: `file-${index}`,
          flag: 'pinned',
          value: true,
        });
      }
    } finally {
      database.close();
    }
    const server = await createServer({ dataDirectory, token });
    try {
      const url = `/projects/${projectId}/file-preferences`;
      const overflow = await server.inject({
        method: 'PUT',
        url,
        headers,
        payload: { path: 'overflow', flag: 'pinned', value: true },
      });
      expect(overflow.statusCode).toBe(409);
      expect(overflow.json()).toEqual({
        code: 'FILE_PREFERENCE_LIMIT_REACHED',
        message: 'File preference limit reached',
      });
      const cleared = await server.inject({
        method: 'PUT',
        url,
        headers,
        payload: { path: 'file-0', flag: 'pinned', value: false },
      });
      expect(cleared.statusCode).toBe(200);
      expect(cleared.json().preferences).toHaveLength(1999);
      const added = await server.inject({
        method: 'PUT',
        url,
        headers,
        payload: { path: 'overflow', flag: 'pinned', value: true },
      });
      expect(added.statusCode).toBe(200);
      expect(added.json().preferences).toHaveLength(2000);
      expect(added.json().preferences).toContainEqual({
        path: 'overflow',
        pinned: true,
        hidden: false,
      });
    } finally {
      await server.close();
    }
  } finally {
    await initial.close();
    await rm(root, { recursive: true, force: true });
  }
});
