import { execFileSync, spawn } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inventoryResponseSchema,
  projectResponseSchema,
} from '@porcelain/contracts/inventory';
import { expect, it, onTestFinished, vi } from 'vitest';

const token = 'fixture-token-with-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };

function launch(dataDirectory: string, overrides: NodeJS.ProcessEnv = {}) {
  const child = spawn(
    process.execPath,
    [new URL('./main.ts', import.meta.url).pathname],
    {
      env: {
        PATH: process.env.PATH,
        PORCELAIN_DATA_DIRECTORY: dataDirectory,
        PORCELAIN_PORT: '0',
        PORCELAIN_TOKEN: token,
        ...overrides,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const output = { stdout: '', stderr: '' };
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    output.stdout += chunk;
  });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    output.stderr += chunk;
  });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code));
  });
  onTestFinished(async () => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL');
    await exited;
  });
  return {
    child,
    output,
    exited,
    address: async () => {
      await vi.waitFor(() => expect(output.stdout).toContain('\n'), {
        timeout: 5000,
      });
      return (JSON.parse(output.stdout.trim()) as { address: string }).address;
    },
  };
}

it('runs registration and refresh, survives restart, and exits cleanly on both shutdown signals', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-process-')),
  );
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'project');
  execFileSync('git', ['init', '-b', 'main', path], {
    env: {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
    },
  });
  const dataDirectory = join(root, 'state');
  const first = launch(dataDirectory);
  const address = await first.address();
  expect(new URL(address).hostname).toBe('127.0.0.1');
  expect(await (await fetch(`${address}/api/health`)).json()).toEqual({
    status: 'ok',
  });
  expect((await fetch(`${address}/api/inventory`)).status).toBe(401);
  const registered = await fetch(`${address}/api/projects`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  expect(registered.status).toBe(200);
  const project = projectResponseSchema.parse(await registered.json());
  const before = inventoryResponseSchema.parse(
    await (await fetch(`${address}/api/inventory`, { headers })).json(),
  );
  expect(before.projects).toEqual([project]);
  const competitor = launch(dataDirectory);
  expect(await competitor.exited).toBe(1);
  expect(competitor.output.stdout).toBe('');
  expect(competitor.output.stderr).toContain('Another Porcelain server');
  first.child.kill('SIGTERM');
  expect(await first.exited).toBe(0);
  const second = launch(dataDirectory);
  const secondAddress = await second.address();
  // The server listens before any repository has answered, so a restart shows
  // the project unavailable until its first refresh lands.
  await expect
    .poll(
      async () =>
        (await fetch(`${secondAddress}/api/inventory`, { headers })).json(),
      { timeout: 10_000 },
    )
    .toEqual(before);
  await rm(path, { recursive: true });
  const refreshed = await fetch(`${secondAddress}/api/inventory/refresh`, {
    method: 'POST',
    headers,
  });
  expect(refreshed.status).toBe(200);
  expect(await refreshed.json()).toMatchObject({
    environmentId: before.environmentId,
    projects: [{ id: project.id, available: false }],
  });
  second.child.kill('SIGINT');
  expect(await second.exited).toBe(0);
  expect(first.output.stderr + second.output.stderr).toBe('');
  expect(first.output.stdout + second.output.stdout).not.toContain(token);
});

it('serves the configured SPA and the /api namespace from one process', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-process-web-')),
  );
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const webRoot = join(root, 'web');
  await mkdir(join(webRoot, 'assets'), { recursive: true });
  await writeFile(join(webRoot, 'index.html'), '<html>production shell</html>');
  await writeFile(join(webRoot, 'assets', 'main-AbCd1234.js'), 'asset');

  const server = launch(join(root, 'state'), {
    PORCELAIN_WEB_ROOT: webRoot,
  });
  const address = await server.address();
  try {
    const shell = await fetch(`${address}/`);
    expect(shell.status).toBe(200);
    expect(await shell.text()).toBe('<html>production shell</html>');
    expect(shell.headers.get('cache-control')).toBe('no-cache');

    const route = await fetch(`${address}/workspace/project`);
    expect(route.status).toBe(200);
    expect(await route.text()).toBe('<html>production shell</html>');

    const asset = await fetch(`${address}/assets/main-AbCd1234.js`);
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe('asset');
    expect(asset.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );

    const api = await fetch(`${address}/api/health`);
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual({ status: 'ok' });

    const unknownApi = await fetch(`${address}/api/not-a-route`);
    expect(unknownApi.status).toBe(404);
    expect(await unknownApi.text()).not.toContain('production shell');
  } finally {
    server.child.kill('SIGTERM');
    expect(await server.exited).toBe(0);
  }
});

it('restarts after a crash with no operator recovery step', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-crash-'));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const server = launch(root);
  await server.address();
  server.child.kill('SIGKILL');
  await server.exited;
  // A killed server leaves its socket behind and nothing releases it by hand.
  expect((await stat(join(root, 'server.sock'))).isSocket()).toBe(true);
  const recovered = launch(root);
  const address = await recovered.address();
  expect(await (await fetch(`${address}/api/health`)).json()).toEqual({
    status: 'ok',
  });
  recovered.child.kill('SIGTERM');
  expect(await recovered.exited).toBe(0);
  // A clean stop takes the socket with it.
  await expect(stat(join(root, 'server.sock'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('exits unsuccessfully on invalid configuration without leaking its token or creating state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-invalid-'));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const dataDirectory = join(root, 'state');
  const server = launch(dataDirectory, { PORCELAIN_PORT: '-1' });
  expect(await server.exited).toBe(1);
  expect(server.output.stdout).toBe('');
  expect(server.output.stderr).not.toContain(token);
  await expect(
    readFile(join(dataDirectory, 'inventory.sqlite')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});
