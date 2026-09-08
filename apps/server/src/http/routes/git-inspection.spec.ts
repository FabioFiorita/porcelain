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
import { expect, it } from 'vitest';
import { GitInspectionTimeoutError } from '../../git/errors/git-inspection-timeout-error.ts';
import { InspectionLimitError } from '../../git/errors/inspection-limit-error.ts';
import { UnsupportedGitFiltersError } from '../../git/errors/unsupported-git-filters-error.ts';
import { UnsupportedPathEncodingError } from '../../git/errors/unsupported-path-encoding-error.ts';
import { createServer } from '../server.ts';

const token = 'fixture-token-with-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };

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
    const endpoint = `/worktrees/${worktreeId}/git`;
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
            url: `/worktrees/not-a-uuid/git/${suffix}`,
            headers,
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await server.inject({
          method: 'GET',
          url: '/worktrees/00000000-0000-4000-8000-000000000000/git/status',
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
    dataDirectory: join(root, 'state'),
    token,
    inspectionGit: () => ({
      readStatus: async () => {
        throw failure;
      },
      readDiff: async () => ({ kind: 'binary' }),
    }),
  });
  try {
    const registered = await server.inject({
      method: 'POST',
      url: '/projects',
      headers,
      payload: { path },
    });
    const project = projectResponseSchema.parse(registered.json());
    const url = `/worktrees/${project.worktrees[0]?.id}/git/status`;
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
