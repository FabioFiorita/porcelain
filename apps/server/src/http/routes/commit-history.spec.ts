import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { devNull, tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitChangesResponseSchema } from '@porcelain/contracts/commit-changes';
import { commitPageResponseSchema } from '@porcelain/contracts/commit-history';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { expect, it } from 'vitest';
import { createServer } from '../server.ts';

const token = 'fixture-history-token-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };
it('lists and inspects registered history through authenticated loopback HTTP with bounded safe failures', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-history-http-')),
  );
  const path = join(root, 'repo');
  await mkdir(path);
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', path, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_COUNT: '0',
        GIT_CONFIG_GLOBAL: devNull,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_PARAMETERS: undefined,
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.test',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.test',
      },
    }).trim();
  git('init', '-b', 'main');
  await writeFile(join(path, 'file'), 'hello\n');
  git('add', '.');
  git('-c', 'commit.gpgsign=false', 'commit', '-m', 'first');
  const oid = git('rev-parse', 'HEAD');
  git('-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'second');
  const server = await createServer({
    dataDirectory: join(root, 'state'),
    token,
  });
  try {
    const registered = await server.inject({
      method: 'POST',
      url: '/projects',
      headers,
      payload: { path },
    });
    const project = projectResponseSchema.parse(registered.json());
    const worktreeId = project.worktrees[0]?.id;
    if (!worktreeId) throw new Error('Missing worktree');
    const url = `/worktrees/${worktreeId}/commits`;
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const listing = await fetch(`${address}${url}?limit=1`, { headers });
    expect(listing.status).toBe(200);
    expect(listing.headers.get('cache-control')).toBe('no-store');
    const raw: unknown = await listing.json();
    const first = commitPageResponseSchema.parse(raw);
    expect(raw).toEqual(first);
    expect(first.commits[0]?.subject).toBe('second');
    expect(first.nextCursor).toBeTypeOf('string');
    const second = await server.inject({
      method: 'GET',
      url: `${url}?cursor=${first.nextCursor}`,
      headers,
    });
    expect(second.statusCode).toBe(200);
    expect(commitPageResponseSchema.parse(second.json()).commits[0]?.oid).toBe(
      oid,
    );
    const inspection = await fetch(`${address}${url}/${oid}/changes`, {
      headers,
    });
    expect(inspection.status).toBe(200);
    const changes: unknown = await inspection.json();
    expect(changes).toEqual(commitChangesResponseSchema.parse(changes));
    expect(changes).toMatchObject({
      comparison: { kind: 'empty-tree' },
      changes: [{ status: 'added', newPath: 'file' }],
    });
    for (const suffix of [
      '?limit=101',
      '?cursor=tampered',
      '?extra=true',
      '/HEAD/changes',
      `/${oid}/changes?parent=1`,
    ]) {
      const response = await server.inject({
        method: 'GET',
        url: `${url}${suffix}`,
        headers,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'INVALID_REQUEST' });
    }
    for (const suffix of ['?limit=invalid', '/invalid/changes']) {
      const response = await server.inject({
        method: 'GET',
        url: `${url}${suffix}`,
      });
      expect(response.statusCode).toBe(401);
    }
    const unknown = '/worktrees/00000000-0000-4000-8000-000000000000/commits';
    for (const target of [unknown, `${unknown}/${oid}/changes`]) {
      const response = await server.inject({
        method: 'GET',
        url: target,
        headers,
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        code: 'WORKTREE_NOT_FOUND',
        message: 'Worktree not found',
      });
    }
    const missing = await server.inject({
      method: 'GET',
      url: `${url}/${'0'.repeat(40)}/changes`,
      headers,
    });
    expect(missing.statusCode).toBe(422);
    expect(missing.json()).toEqual({
      code: 'HISTORY_SNAPSHOT_UNAVAILABLE',
      message: 'History snapshot is unavailable; start a new listing',
    });
    await writeFile(join(path, 'large'), 'x'.repeat(1024 * 1024));
    git('add', '.');
    git('-c', 'commit.gpgsign=false', 'commit', '-m', 'large');
    const limited = await server.inject({
      method: 'GET',
      url: `${url}/${git('rev-parse', 'HEAD')}/changes`,
      headers,
    });
    expect(limited.statusCode).toBe(422);
    expect(limited.json()).toEqual({
      code: 'READ_LIMIT_EXCEEDED',
      message: 'History read exceeds its limit',
    });
    expect(JSON.stringify(limited.json())).not.toContain(path);
    await rm(path, { recursive: true, force: true });
    await server.inject({ method: 'POST', url: '/inventory/refresh', headers });
    expect(
      (await server.inject({ method: 'GET', url, headers })).statusCode,
    ).toBe(422);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
