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
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createServer } from '../server.ts';

const execute = promisify(execFile);
const token = 'disposable-token-with-32-characters';
const headers = { authorization: `Bearer ${token}` };
let root: string;
let checkout: string;
let server: Awaited<ReturnType<typeof createServer>>;
let prefix: string;
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
            url: `/git-action-requests/${requestId}`,
            headers,
          })
        ).json<{ state: string }>().state,
    )
    .not.toBe('running');
  return (
    await server.inject({
      method: 'GET',
      url: `/git-action-requests/${requestId}`,
      headers,
    })
  ).json();
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-action-http-'));
  vi.stubEnv('HOME', root);
  vi.stubEnv('XDG_CONFIG_HOME', root);
  checkout = join(root, 'checkout');
  await mkdir(checkout);
  await git('init', '-b', 'main');
  await git('config', 'user.name', 'Fixture');
  await git('config', 'user.email', 'fixture@example.invalid');
  await writeFile(join(checkout, 'file'), 'base\n');
  await git('add', 'file');
  await git('commit', '-m', 'base');
  server = await createServer({ dataDirectory: join(root, 'data'), token });
  const response = await server.inject({
    method: 'POST',
    url: '/projects',
    headers,
    payload: { path: checkout },
  });
  const project = response.json<{ id: string; worktrees: { id: string }[] }>();
  prefix = `/projects/${project.id}/worktrees/${project.worktrees[0]?.id}/git`;
});
afterEach(async () => {
  await server.close();
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

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
    url: `/git-action-requests/${randomUUID()}`,
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
  expect(await outcome(requestId)).toMatchObject({
    state: 'succeeded',
    refreshRequired: true,
  });
  expect(await git('rev-list', '--count', 'HEAD')).toBe('2');
  const reuse = await server.inject({
    method: 'POST',
    url: `${prefix}/commit`,
    headers,
    payload: { preparationId, requestId: randomUUID() },
  });
  expect(reuse.statusCode, reuse.body).toBe(409);
  await server.close();
  server = await createServer({ dataDirectory: join(root, 'data'), token });
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
  expect(await outcome(requestId)).toMatchObject({
    state: 'rejected',
    reason: 'STALE_PREPARATION',
    refreshRequired: false,
  });
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
  const preparationId = await preparation('commit', { message: 'interrupted' });
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
    url: `/git-action-requests/${requestId}`,
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
  server = await createServer({ dataDirectory: join(root, 'data'), token });
  expect(await outcome(requestId)).toMatchObject({
    state: 'indeterminate',
    refreshRequired: true,
  });
  expect(await git('rev-list', '--count', 'HEAD')).toBe('1');
});
