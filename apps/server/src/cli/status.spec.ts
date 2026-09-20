import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { startRuntime } from '../lifecycle/runtime.ts';
import { reportStatus, statusExitCodes } from './status.ts';

function recorder() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    output: {
      stdout: (message: string) => out.push(message),
      stderr: (message: string) => err.push(message),
    },
  };
}

it('reports a running server and exits zero', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-status-'));
  const dataDirectory = join(root, 'state');
  const runtime = await startRuntime({
    dataDirectory,
    projectHome: join(root, 'home'),
    port: 0,
  });
  try {
    const { out, err, output } = recorder();
    expect(await reportStatus({ dataDirectory }, output)).toBe(
      statusExitCodes.running,
    );
    expect(out.join('')).toContain(runtime.address);
    expect(out.join('')).toContain(dataDirectory);
    expect(err).toEqual([]);
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('says so and exits nonzero when nothing is running', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-status-absent-'));
  try {
    const { out, err, output } = recorder();
    // A directory that has never been used is not an error, just not running.
    expect(
      await reportStatus({ dataDirectory: join(root, 'state') }, output),
    ).toBe(statusExitCodes.notRunning);
    expect(out.join('')).toContain('not running');
    expect(err).toEqual([]);

    // Neither is one a server has stopped using.
    const dataDirectory = join(root, 'used');
    const runtime = await startRuntime({
      dataDirectory,
      projectHome: join(root, 'home'),
      port: 0,
    });
    await runtime.close();
    const after = recorder();
    expect(await reportStatus({ dataDirectory }, after.output)).toBe(
      statusExitCodes.notRunning,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('keeps a separate code for a probe it could not complete', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-status-failed-'));
  try {
    const { err, output } = recorder();
    const deep = join(root, 'd'.repeat(90), 'e'.repeat(90));
    expect(await reportStatus({ dataDirectory: deep }, output)).toBe(
      statusExitCodes.failed,
    );
    expect(err.join('')).toContain('shorter data directory');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('separates a socket it cannot read from one that is simply absent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-status-foreign-'));
  const dataDirectory = join(root, 'state');
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  // Something else on this machine is holding the path and accepting
  // connections, which a bare connect test would have called "Porcelain".
  const foreign = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"not":"porcelain"}');
  });
  await new Promise<void>((resolve) =>
    foreign.listen(join(dataDirectory, 'server.sock'), () => resolve()),
  );
  try {
    const { err, output } = recorder();
    expect(await reportStatus({ dataDirectory }, output)).toBe(
      statusExitCodes.failed,
    );
    expect(err.join('')).toContain('unrecognizable');
  } finally {
    await new Promise<void>((resolve) => foreign.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});

it('treats a socket that never answers as unreadable, not stale', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-status-silent-'));
  const dataDirectory = join(root, 'state');
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  const silent = createServer(() => {
    // Accept the connection and never answer.
  });
  await new Promise<void>((resolve) =>
    silent.listen(join(dataDirectory, 'server.sock'), () => resolve()),
  );
  try {
    const { err, output } = recorder();
    expect(await reportStatus({ dataDirectory }, output, 200)).toBe(
      statusExitCodes.failed,
    );
    expect(err.join('')).toContain('did not answer in time');
  } finally {
    silent.closeAllConnections();
    await new Promise<void>((resolve) => silent.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
