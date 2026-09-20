import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createIsolatedGit } from '@porcelain/git/fixtures/isolated-git';
import { InspectionGit } from '@porcelain/git/inspection-git';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pairDevice, pairingReach } from '../helpers/paired-server.ts';

import { createServer } from '../server.ts';

describe('Git actions HTTP', () => {
  const execute = promisify(execFile);
  let root: string;
  let checkout: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  let prefix: string;
  let headers: { authorization: string };
  async function git(...args: string[]) {
    return (await execute('git', ['-C', checkout, ...args])).stdout.trimEnd();
  }
  async function preparation(path: string, payload: object) {
    const response = await server.inject({
      method: 'POST',
      url: `${prefix}/${path}/prepare`,
      headers,
      payload,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.body).not.toContain('fingerprint');
    return response.json<{ preparationId: string }>().preparationId;
  }
  async function outcome(requestId: string) {
    await expect
      .poll(
        async () =>
          (
            await server.inject({
              method: 'GET',
              url: `/api/git-action-requests/${requestId}`,
              headers,
            })
          ).json<{ state: string }>().state,
        { timeout: 10_000 },
      )
      .not.toBe('running');
    return (
      await server.inject({
        method: 'GET',
        url: `/api/git-action-requests/${requestId}`,
        headers,
      })
    ).json();
  }
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'porcelain-action-http-'));
    vi.stubEnv('HOME', root);
    vi.stubEnv('XDG_CONFIG_HOME', root);
    vi.stubEnv('PATH', `${await createIsolatedGit(root)}:${process.env.PATH}`);
    checkout = join(root, 'checkout');
    await mkdir(checkout);
    await git('init', '-b', 'main');
    await git('config', 'user.name', 'Fixture');
    await git('config', 'user.email', 'fixture@example.invalid');
    await writeFile(join(checkout, 'file'), 'base\n');
    await git('add', 'file');
    await git('commit', '-m', 'base');
    server = await createServer({
      pairingReach,
      dataDirectory: join(root, 'data'),
      projectHome: join(root, 'data'),
    });
    headers = await pairDevice(server, server.application);
    const response = await server.inject({
      method: 'POST',
      url: '/api/projects',
      headers,
      payload: { path: checkout },
    });
    const project = response.json<{
      id: string;
      worktrees: { id: string }[];
    }>();
    prefix = `/api/projects/${project.id}/worktrees/${project.worktrees[0]?.id}/git`;
  });
  afterEach(async () => {
    await server.close();
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it.each(['merge', 'rebase'])(
    'carries the %s pull strategy through preparation and execution',
    async (strategy) => {
      const remote = join(root, 'remote.git');
      await git('init', '--bare', remote);
      await git('remote', 'add', 'origin', remote);
      const base = await git('rev-parse', 'HEAD');
      await writeFile(join(checkout, 'upstream'), 'upstream\n');
      await git('add', 'upstream');
      await git('commit', '-m', 'upstream');
      await git('push', '-u', 'origin', 'main');
      await git('reset', '--hard', base);
      await writeFile(join(checkout, 'local'), 'local\n');
      await git('add', 'local');
      await git('commit', '-m', 'local');
      const preparationId = await preparation('pull', {
        remoteName: 'origin',
        sourceRef: 'refs/heads/main',
        strategy,
      });
      const requestId = randomUUID();
      const response = await server.inject({
        method: 'POST',
        url: `${prefix}/pull`,
        headers,
        payload: { preparationId, requestId },
      });
      expect(response.statusCode, response.body).toBe(202);
      expect(await outcome(requestId)).toMatchObject({
        state: 'succeeded',
        action: 'pull',
      });
      expect(
        (await git('show', '-s', '--format=%P', 'HEAD')).split(' '),
      ).toHaveLength(strategy === 'merge' ? 2 : 1);
    },
  );

  it('reads comments without waiting for a slow change list', async () => {
    await writeFile(join(checkout, 'file'), 'changed\n');
    const started = Promise.withResolvers<void>();
    const gate = Promise.withResolvers<void>();
    const original = InspectionGit.prototype.readStatus;
    const status = vi
      .spyOn(InspectionGit.prototype, 'readStatus')
      .mockImplementationOnce(async function (this: InspectionGit, signal) {
        started.resolve();
        await gate.promise;
        return original.call(this, signal);
      });
    const url = `/api/worktrees/${prefix.split('/')[5]}`;
    const changes = server.inject({ url: `${url}/changes`, headers });
    try {
      await started.promise;
      const response = await server.inject({ url: `${url}/comments`, headers });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    } finally {
      gate.resolve();
      await changes;
      status.mockRestore();
    }
  });

  /**
   * A mark is a claim about one file in the state the reader saw it. Both of
   * its comparisons are part of that claim, and none of it needs a patch:
   * staging an edit and then editing again must not be markable from half the
   * change, and reading the hunks is a separate request nobody made here.
   */
  it('validates only the marked file, over both of its comparisons, without reading a diff', async () => {
    await writeFile(join(checkout, 'other'), 'base\n');
    await git('add', 'other');
    await git('commit', '-m', 'other fixture');
    await writeFile(join(checkout, 'file'), 'staged\n');
    await git('add', 'file');
    await writeFile(join(checkout, 'file'), 'unstaged\n');
    await writeFile(join(checkout, 'other'), 'unreviewed change\n');
    const url = `/api/worktrees/${prefix.split('/')[5]}`;
    const list = (await server.inject({ url: `${url}/changes`, headers }))
      .json()
      .changes.find((entry: { path: string }) => entry.path === 'file');
    expect(
      list.comparisons.map((change: { scope: string }) => change.scope),
    ).toEqual(['staged', 'unstaged']);
    const diff = vi.spyOn(InspectionGit.prototype, 'readDiffs');
    const mark = () =>
      server.inject({
        method: 'PUT',
        url: `${url}/reviewed`,
        headers,
        payload: {
          path: 'file',
          reviewed: true,
          fingerprint: list.fingerprint,
        },
      });
    try {
      expect((await mark()).statusCode).toBe(200);
      // Changing the other file leaves this mark alone.
      await writeFile(join(checkout, 'other'), 'changed again\n');
      expect((await mark()).statusCode).toBe(200);
      // The staged side is untouched; only the working side moved, and the
      // fingerprint covers both, so the same mark is now refused.
      await writeFile(join(checkout, 'file'), 'edited after review\n');
      expect((await mark()).statusCode).toBe(409);
      expect(diff).not.toHaveBeenCalled();
    } finally {
      diff.mockRestore();
    }
  });

  it.each([false, true])(
    'archives committed layer notes and preserves remaining review work (selected: %s)',
    async (selected) => {
      await writeFile(join(checkout, 'file'), 'staged\n');
      await git('add', 'file');
      await writeFile(join(checkout, 'file'), 'unstaged\n');
      await writeFile(join(checkout, 'other'), 'remaining\n');
      const worktreeId = prefix.split('/')[5];
      const projectId = prefix.split('/')[3];
      const layerUrl = `/api/worktrees/${worktreeId}/review-layers`;
      const layerId = randomUUID();
      const files = [
        { path: 'file', scope: 'staged', note: 'Staged explanation' },
        { path: 'file', scope: 'unstaged', note: 'Working explanation' },
        { path: 'other', scope: 'unstaged', note: 'Remaining explanation' },
      ];
      const written = await server.inject({
        method: 'PUT',
        url: layerUrl,
        headers,
        payload: {
          expectedRevision: 0,
          layers: [
            {
              id: layerId,
              title: 'Review intent',
              summary: 'Why this changes',
              files,
            },
          ],
        },
      });
      expect(written.statusCode, written.body).toBe(200);
      const preparationId = await preparation('commit', {
        message: 'Reviewed change',
        ...(selected ? { paths: ['file'] } : {}),
      });
      const requestId = randomUUID();
      await server.inject({
        method: 'POST',
        url: `${prefix}/commit`,
        headers,
        payload: { preparationId, requestId },
      });
      const completed = await outcome(requestId);
      expect(completed).toMatchObject({
        state: 'succeeded',
        reviewLayersUpdated: true,
      });
      const oid = await git('rev-parse', 'HEAD');
      const snapshotUrl = `/api/projects/${projectId}/commits/${oid}/review-layers`;
      const snapshot = await server.inject({ url: snapshotUrl, headers });
      expect(snapshot.statusCode, snapshot.body).toBe(200);
      expect(snapshot.json().layers[0]).toMatchObject({
        title: 'Review intent',
        summary: 'Why this changes',
        files: selected ? files.slice(0, 2) : files.slice(0, 1),
      });
      const remaining = await server.inject({ url: layerUrl, headers });
      expect(remaining.json()).toMatchObject({
        revision: 2,
        layers: [{ files: selected ? files.slice(2) : files.slice(1) }],
      });
      await server.inject({
        method: 'PUT',
        url: layerUrl,
        headers,
        payload: { expectedRevision: 2, layers: [] },
      });
      expect(
        (await server.inject({ url: snapshotUrl, headers })).json(),
      ).toEqual(snapshot.json());
    },
  );

  it('authenticates and validates before preparing or launching Git actions', async () => {
    expect(
      (
        await server.inject({
          method: 'POST',
          url: `${prefix}/commit/prepare`,
          payload: { message: 'test' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: `${prefix}/commit/prepare`,
          headers,
          payload: { message: 'test', args: ['--amend'] },
        })
      ).statusCode,
    ).toBe(400);
    const missing = await server.inject({
      method: 'GET',
      url: `/api/git-action-requests/${randomUUID()}`,
      headers,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.headers['cache-control']).toBe('no-store');
  });

  it('accepts a commit once, returns its receipt after restart, and rejects preparation reuse', async () => {
    await writeFile(join(checkout, 'file'), 'selected\n');
    await git('add', 'file');
    const preparationId = await preparation('commit', { message: 'selected' });
    const requestId = randomUUID();
    const response = await server.inject({
      method: 'POST',
      url: `${prefix}/commit`,
      headers,
      payload: { preparationId, requestId },
    });
    expect(response.statusCode, response.body).toBe(202);
    const duplicate = await server.inject({
      method: 'POST',
      url: `${prefix}/commit`,
      headers,
      payload: { preparationId, requestId },
    });
    expect([200, 202]).toContain(duplicate.statusCode);
    const completed = await outcome(requestId);
    expect(completed).toMatchObject({
      state: 'succeeded',
      refreshRequired: true,
    });
    const replay = await server.inject({
      method: 'POST',
      url: `${prefix}/commit`,
      headers,
      payload: { preparationId, requestId },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(completed);
    expect(await git('rev-list', '--count', 'HEAD')).toBe('2');
    const reuse = await server.inject({
      method: 'POST',
      url: `${prefix}/commit`,
      headers,
      payload: { preparationId, requestId: randomUUID() },
    });
    expect(reuse.statusCode, reuse.body).toBe(409);
    await server.close();
    server = await createServer({
      pairingReach,
      dataDirectory: join(root, 'data'),
      projectHome: join(root, 'data'),
    });
    headers = await pairDevice(server, server.application);
    expect(await outcome(requestId)).toMatchObject({ state: 'succeeded' });
    expect(await git('rev-list', '--count', 'HEAD')).toBe('2');
  });

  it('rejects changed content after preparation without committing it', async () => {
    await writeFile(join(checkout, 'file'), 'selected\n');
    await git('add', 'file');
    const preparationId = await preparation('commit', { message: 'selected' });
    await writeFile(join(checkout, 'file'), 'external\n');
    const requestId = randomUUID();
    await server.inject({
      method: 'POST',
      url: `${prefix}/commit`,
      headers,
      payload: { preparationId, requestId },
    });
    const rejected = await outcome(requestId);
    expect(rejected).toMatchObject({
      state: 'rejected',
      reason: 'STALE_PREPARATION',
      refreshRequired: false,
    });
    const replay = await server.inject({
      method: 'POST',
      url: `${prefix}/commit`,
      headers,
      payload: { preparationId, requestId },
    });
    expect(replay.statusCode).toBe(409);
    expect(replay.json()).toEqual(rejected);
    expect(await git('rev-list', '--count', 'HEAD')).toBe('1');
  });

  it('supports the new-file stash and pop workflow through real loopback HTTP', async () => {
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing address');
    const base = `http://127.0.0.1:${address.port}`;
    await writeFile(join(checkout, 'new'), 'saved\n');
    const prepared = await fetch(`${base}${prefix}/stash/create/prepare`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'new files', includeUntracked: true }),
    });
    const { preparationId } = (await prepared.json()) as {
      preparationId: string;
    };
    const requestId = randomUUID();
    const accepted = await fetch(`${base}${prefix}/stash/create`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ preparationId, requestId }),
    });
    expect(accepted.status).toBe(202);
    const created = await outcome(requestId);
    expect(created.state).toBe('succeeded');
    const popPreparation = await preparation('stash/pop', {
      stashOid: created.result.stashOid,
      restoreIndex: false,
    });
    const popRequest = randomUUID();
    await server.inject({
      method: 'POST',
      url: `${prefix}/stash/pop`,
      headers,
      payload: { preparationId: popPreparation, requestId: popRequest },
    });
    expect(await outcome(popRequest)).toMatchObject({
      state: 'succeeded',
      result: { stashRetained: false },
    });
    expect(await readFile(join(checkout, 'new'), 'utf8')).toBe('saved\n');
  });

  it('keeps accepted work after socket loss, serves receipts during it, and finalizes before shutdown', async () => {
    const marker = join(root, 'hook-started');
    const hook = join(checkout, '.git/hooks/pre-commit');
    await writeFile(
      hook,
      `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ready'); setInterval(() => {}, 1000);\n`,
    );
    await chmod(hook, 0o700);
    await writeFile(join(checkout, 'file'), 'selected\n');
    await git('add', 'file');
    const preparationId = await preparation('commit', {
      message: 'interrupted',
    });
    const requestId = randomUUID();
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing address');
    await new Promise<void>((resolve, reject) => {
      const request = httpRequest(
        `http://127.0.0.1:${address.port}${prefix}/commit`,
        {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
        },
        (response) => {
          response.destroy();
          resolve();
        },
      );
      request.on('error', reject);
      request.end(JSON.stringify({ preparationId, requestId }));
    });
    await expect.poll(async () => readFile(marker, 'utf8')).toBe('ready');
    const running = await server.inject({
      method: 'GET',
      url: `/api/git-action-requests/${requestId}`,
      headers,
    });
    expect(running.json()).toMatchObject({
      state: 'running',
      refreshRequired: true,
    });
    expect(
      (
        await server.inject({
          method: 'POST',
          url: `${prefix}/commit`,
          headers,
          payload: { preparationId, requestId },
        })
      ).statusCode,
    ).toBe(202);
    await server.close();
    server = await createServer({
      pairingReach,
      dataDirectory: join(root, 'data'),
      projectHome: join(root, 'data'),
    });
    headers = await pairDevice(server, server.application);
    const interrupted = await outcome(requestId);
    expect(interrupted).toMatchObject({
      state: 'indeterminate',
      refreshRequired: true,
    });
    const replay = await server.inject({
      method: 'POST',
      url: `${prefix}/commit`,
      headers,
      payload: { preparationId, requestId },
    });
    expect(replay.statusCode).toBe(503);
    expect(replay.json()).toEqual(interrupted);
    expect(await git('rev-list', '--count', 'HEAD')).toBe('1');
  });
});
