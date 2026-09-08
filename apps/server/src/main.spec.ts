import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, unlink } from 'node:fs/promises';
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
  expect(await (await fetch(`${address}/health`)).json()).toEqual({
    status: 'ok',
  });
  expect((await fetch(`${address}/inventory`)).status).toBe(401);
  const registered = await fetch(`${address}/projects`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  expect(registered.status).toBe(200);
  const project = projectResponseSchema.parse(await registered.json());
  const before = inventoryResponseSchema.parse(
    await (await fetch(`${address}/inventory`, { headers })).json(),
  );
  expect(before.projects).toEqual([project]);
  const competitor = launch(dataDirectory);
  expect(await competitor.exited).toBe(1);
  expect(competitor.output.stdout).toBe('');
  expect(competitor.output.stderr).toContain('ownership file');
  first.child.kill('SIGTERM');
  expect(await first.exited).toBe(0);
  const second = launch(dataDirectory);
  const secondAddress = await second.address();
  expect(
    await (await fetch(`${secondAddress}/inventory`, { headers })).json(),
  ).toEqual(before);
  await rm(path, { recursive: true });
  const refreshed = await fetch(`${secondAddress}/inventory/refresh`, {
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

it('retains a crash ownership file until explicit operator recovery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-crash-'));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const server = launch(root);
  await server.address();
  server.child.kill('SIGKILL');
  await server.exited;
  const lock = await readFile(join(root, 'server.lock'), 'utf8');
  const retry = launch(root);
  expect(await retry.exited).toBe(1);
  expect(await readFile(join(root, 'server.lock'), 'utf8')).toBe(lock);
  // The fixture process is confirmed dead; model the documented operator recovery.
  await unlink(join(root, 'server.lock'));
  const recovered = launch(root);
  await recovered.address();
  recovered.child.kill('SIGTERM');
  expect(await recovered.exited).toBe(0);
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
