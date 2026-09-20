import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitDiffResponseSchema } from '@porcelain/contracts/git-diff';
import { gitStatusResponseSchema } from '@porcelain/contracts/git-status';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { GitInspectionTimeoutError } from '@porcelain/git/errors/git-inspection-timeout-error';
import { InspectionLimitError } from '@porcelain/git/errors/inspection-limit-error';
import { UnsupportedGitFiltersError } from '@porcelain/git/errors/unsupported-git-filters-error';
import { UnsupportedPathEncodingError } from '@porcelain/git/errors/unsupported-path-encoding-error';
import { expect, it } from 'vitest';
import { pairDevice, pairingReach } from '../helpers/paired-server.ts';
import { createServer } from '../server.ts';

it('serves status and selected diffs over authenticated loopback HTTP and rejects stale or invalid selections', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-git-http-')),
  );
  const path = join(root, 'checkout');
  await mkdir(path);
  execFileSync('git', ['init', '-b', 'main', path], { stdio: 'ignore' });
  await writeFile(join(path, 'file'), 'staged\n');
  execFileSync('git', ['-C', path, 'add', '.']);
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
    const endpoint = `/api/worktrees/${worktreeId}/git`;
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const response = await fetch(`${address}${endpoint}/status`, { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const status = gitStatusResponseSchema.parse(await response.json());
    expect(status).toMatchObject({
      worktreeId,
      consistency: 'best-effort',
      headOid: null,
    });
    const body = {
      expectedStatusToken: status.statusToken,
      change: { scope: 'staged', oldPath: null, newPath: 'file' },
    };
    const diffResponse = await fetch(`${address}${endpoint}/diff`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(diffResponse.status).toBe(200);
    const raw: unknown = await diffResponse.json();
    const diff = gitDiffResponseSchema.parse(raw);
    expect(raw).toEqual(diff);
    expect(diff.content).toMatchObject({
      kind: 'text',
      patch: expect.stringContaining('+staged'),
    });
    for (const [method, suffix] of [
      ['GET', 'status'],
      ['POST', 'diff'],
    ] as const) {
      expect(
        (await server.inject({ method, url: `${endpoint}/${suffix}` }))
          .statusCode,
      ).toBe(401);
      expect(
        (
          await server.inject({
            method,
            url: `/api/worktrees/not-a-uuid/git/${suffix}`,
            headers,
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await server.inject({
          method: 'GET',
          url: `/api/worktrees/${'0'.repeat(32)}/git/status`,
          headers,
        })
      ).statusCode,
    ).toBe(404);
    for (const payload of [
      { ...body, extra: true },
      { ...body, change: { ...body.change, newPath: '../outside' } },
      { ...body, change: { ...body.change, scope: 'untracked' } },
    ]) {
      expect(
        (
          await server.inject({
            method: 'POST',
            url: `${endpoint}/diff`,
            headers,
            payload,
          })
        ).statusCode,
      ).toBe(400);
    }
    await writeFile(join(path, 'new-file'), 'concurrent\n');
    const stale = await server.inject({
      method: 'POST',
      url: `${endpoint}/diff`,
      headers,
      payload: body,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({
      code: 'WORKTREE_CHANGED',
      message: 'Refresh status and retry inspection',
    });
    await rename(path, join(root, 'moved'));
    const unavailable = await server.inject({
      method: 'GET',
      url: `${endpoint}/status`,
      headers,
    });
    expect(unavailable.statusCode).toBe(422);
    expect(unavailable.json()).toEqual({
      code: 'REPOSITORY_UNAVAILABLE',
      message: 'Repository could not be inspected',
    });
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('maps inspection limits, unsupported paths and infrastructure failures without exposing diagnostics', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-git-errors-')),
  );
  const path = join(root, 'checkout');
  await mkdir(path);
  execFileSync('git', ['init', '-b', 'main', path], { stdio: 'ignore' });
  let failure: Error = new InspectionLimitError({
    cause: new Error('private path'),
  });
  const server = await createServer({
    pairingReach,
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'state'),
    inspectionGit: () => ({
      readStatus: async () => {
        throw failure;
      },
      readDiff: async () => ({ kind: 'binary' }),
      readDiffs: async () => [],
    }),
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
    const url = `/api/worktrees/${project.worktrees[0]?.id}/git/status`;
    for (const [error, code, statusCode] of [
      [failure, 'INSPECTION_LIMIT', 413],
      [new UnsupportedGitFiltersError(), 'UNSUPPORTED_GIT_FILTERS', 422],
      [
        new GitInspectionTimeoutError(new Error('private subprocess')),
        'SERVICE_UNAVAILABLE',
        503,
      ],
      [new UnsupportedPathEncodingError(), 'UNSUPPORTED_PATH_ENCODING', 422],
      [
        new DOMException('private deadline', 'TimeoutError'),
        'SERVICE_UNAVAILABLE',
        503,
      ],
      [new Error('private database details'), 'INTERNAL_ERROR', 500],
    ] as const) {
      failure = error;
      const response = await server.inject({ method: 'GET', url, headers });
      expect(response.statusCode).toBe(statusCode);
      expect(response.json().code).toBe(code);
      expect(response.body).not.toContain('private');
    }
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('aborts the signal a route passes into its lane when the client disconnects', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-request-disconnect-')),
  );
  const path = join(root, 'checkout');
  await mkdir(path);
  execFileSync('git', ['init', '-b', 'main', path], { stdio: 'ignore' });
  const entered = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  const server = await createServer({
    pairingReach,
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'state'),
    inspectionGit: () => ({
      // The signal here is the one the request hook created and the route
      // handed to the lane; a queued caller is removed by the same signal.
      readStatus: (signal) =>
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
      readDiff: async () => ({ kind: 'binary' }),
      readDiffs: async () => [],
    }),
  });
  const headers = await pairDevice(server, server.application);
  const leaving = new AbortController();
  try {
    const registered = projectResponseSchema.parse(
      (
        await server.inject({
          method: 'POST',
          url: '/api/projects',
          headers,
          payload: { path },
        })
      ).json(),
    );
    const worktreeId = registered.worktrees[0]?.id;
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const response = fetch(
      `${address}/api/worktrees/${worktreeId}/git/status`,
      { headers, signal: leaving.signal },
    ).catch((error: unknown) => error);
    await entered.promise;
    leaving.abort();
    await cancelled.promise;
    expect(await response).toMatchObject({ name: 'AbortError' });
  } finally {
    leaving.abort();
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
}, 20_000);
