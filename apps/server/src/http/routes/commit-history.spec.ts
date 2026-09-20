import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { devNull, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  commitDiffsResponseSchema,
  commitFilesResponseSchema,
} from '@porcelain/contracts/commit-changes';
import { commitPageResponseSchema } from '@porcelain/contracts/commit-history';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { expect, it } from 'vitest';
import { pairDevice, pairingReach } from '../helpers/paired-server.ts';
import { createServer } from '../server.ts';

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
    pairingReach,
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'state'),
  });
  const headers = await pairDevice(server, server.application);
  try {
    const registered = await server.inject({
      method: 'POST',
      url: '/api/projects',
      headers,
      payload: { path },
    });
    const project = projectResponseSchema.parse(registered.json());
    const worktreeId = project.worktrees[0]?.id;
    if (!worktreeId) throw new Error('Missing worktree');
    const url = `/api/worktrees/${worktreeId}/commits`;
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const listing = await fetch(`${address}${url}?limit=1`, { headers });
    expect(listing.status).toBe(200);
    expect(listing.headers.get('cache-control')).toBe('no-store');
    const raw: unknown = await listing.json();
    const first = commitPageResponseSchema.parse(raw);
    expect(raw).toEqual(first);
    expect(first.commits[0]?.subject).toBe('second');
    expect(first.nextAfter).toHaveLength(1);
    expect(first.restarted).toBe(false);
    const second = await server.inject({
      method: 'GET',
      url: `${url}?after=${first.nextAfter?.join(',')}&tip=${first.tip}`,
      headers,
    });
    expect(second.statusCode).toBe(200);
    expect(commitPageResponseSchema.parse(second.json()).commits[0]?.oid).toBe(
      oid,
    );
    const inspection = await fetch(`${address}${url}/${oid}/files`, {
      headers,
    });
    expect(inspection.status).toBe(200);
    const files: unknown = await inspection.json();
    expect(files).toEqual(commitFilesResponseSchema.parse(files));
    expect(files).toMatchObject({
      comparison: { kind: 'empty-tree' },
      files: [{ status: 'added', newPath: 'file' }],
    });
    // The list carries no patches at all; they are asked for by name.
    const patches = await server.inject({
      method: 'POST',
      url: `${url}/${oid}/diffs`,
      headers,
      payload: { paths: [['file']] },
    });
    expect(patches.statusCode).toBe(200);
    const diffs = commitDiffsResponseSchema.parse(patches.json());
    expect(diffs.diffs[0]?.content).toMatchObject({ kind: 'text' });
    for (const suffix of [
      '?limit=101',
      '?after=tampered',
      '?extra=true',
      '/HEAD/files',
      `/${oid}/files?parent=1`,
    ]) {
      const response = await server.inject({
        method: 'GET',
        url: `${url}${suffix}`,
        headers,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'INVALID_REQUEST' });
    }
    for (const suffix of ['?limit=invalid', '/invalid/files']) {
      const response = await server.inject({
        method: 'GET',
        url: `${url}${suffix}`,
      });
      expect(response.statusCode).toBe(401);
    }
    const unknown = `/api/worktrees/${'0'.repeat(32)}/commits`;
    for (const target of [unknown, `${unknown}/${oid}/files`]) {
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
      url: `${url}/${'0'.repeat(40)}/files`,
      headers,
    });
    expect(missing.statusCode).toBe(422);
    expect(missing.json()).toEqual({
      code: 'HISTORY_SNAPSHOT_UNAVAILABLE',
      message: 'History snapshot is unavailable; start a new listing',
    });
    // The commit that used to be unopenable. Returning every patch at once
    // refused above a megabyte, so the largest commits were the ones that
    // could not be read; the list carries no patches, so it opens.
    await mkdir(join(path, 'bulk'));
    await Promise.all(
      Array.from({ length: 400 }, (_, index) =>
        writeFile(join(path, 'bulk', `file-${index}.txt`), 'x'.repeat(4096)),
      ),
    );
    git('add', '.');
    git('-c', 'commit.gpgsign=false', 'commit', '-m', 'bulk');
    const bulkOid = git('rev-parse', 'HEAD');
    const bulk = await server.inject({
      method: 'GET',
      url: `${url}/${bulkOid}/files`,
      headers,
    });
    expect(bulk.statusCode).toBe(200);
    const bulkFiles = commitFilesResponseSchema.parse(bulk.json());
    expect(bulkFiles.files).toHaveLength(400);
    // And its patches come a batch at a time rather than all at once.
    const batch = await server.inject({
      method: 'POST',
      url: `${url}/${bulkOid}/diffs`,
      headers,
      payload: {
        paths: bulkFiles.files
          .slice(0, 5)
          .map((file) => [file.newPath ?? file.oldPath]),
      },
    });
    expect(batch.statusCode).toBe(200);
    expect(commitDiffsResponseSchema.parse(batch.json()).diffs).toHaveLength(5);
    await rm(path, { recursive: true, force: true });
    await server.inject({
      method: 'GET',
      url: '/api/inventory',
      headers,
    });
    expect(
      (await server.inject({ method: 'GET', url, headers })).statusCode,
    ).toBe(422);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
