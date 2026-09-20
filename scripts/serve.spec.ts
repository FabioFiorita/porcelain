import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { pairThroughSocket } from '../apps/server/src/development/pair-through-socket.ts';
import {
  parseCliArguments,
  runBuildCommand,
  runServe,
  ServeConfigurationError,
  type ServeSettings,
} from './serve.ts';

async function temporaryRoot(prefix: string) {
  return mkdtemp(join(tmpdir(), prefix));
}

it('resolves a persistent default and validates explicit listener options', async () => {
  const home = await temporaryRoot('porcelain-serve-home-');
  try {
    expect(parseCliArguments([], {}, home)).toEqual({
      command: 'serve',
      settings: {
        dataDirectory: join(home, '.porcelain'),
        projectHome: home,
        host: '127.0.0.1',
        port: 3000,
        webRoot: expect.stringContaining('/apps/web/dist'),
        allowedHosts: [],
      },
    });
    expect(
      parseCliArguments(
        ['--', '--lan', '--port=4321', '--data-directory', join(home, 'state')],
        {},
        home,
      ),
    ).toMatchObject({
      command: 'serve',
      settings: {
        dataDirectory: join(home, 'state'),
        host: '0.0.0.0',
        port: 4321,
      },
    });
    expect(() =>
      parseCliArguments(['--lan', '--host', '127.0.0.1'], {}, home),
    ).toThrow(ServeConfigurationError);
    expect(() => parseCliArguments(['--port', '65536'], {}, home)).toThrow(
      'integer from 0 to 65535',
    );
    expect(() =>
      parseCliArguments(['--data-directory', 'relative'], {}, home),
    ).toThrow('absolute path');
    expect(() => parseCliArguments(['--unknown'], {}, home)).toThrow(
      'Unknown option',
    );
    // An installation upgraded from the token world fails loudly, with the
    // command that replaces the option.
    expect(() =>
      parseCliArguments(['--token-file', join(home, 'token')], {}, home),
    ).toThrow('porcelain pair');
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

it.runIf(process.platform === 'linux')(
  'waits for a descendant that ignores SIGTERM before the fallback kill',
  async () => {
    const root = await temporaryRoot('porcelain-serve-cancel-');
    const childPidFile = join(root, 'child.pid');
    const controller = new AbortController();
    const descendantCode = `
      const { writeFileSync } = require('node:fs');
      process.on('SIGTERM', () => {});
      writeFileSync(${JSON.stringify(childPidFile)}, String(process.pid));
      setInterval(() => {}, 1000);
    `;
    const childCode = `
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, ['-e', ${JSON.stringify(descendantCode)}], { stdio: 'ignore' });
      setInterval(() => {}, 1000);
    `;
    const running = runBuildCommand(
      process.execPath,
      ['-e', childCode],
      root,
      controller.signal,
      { cancellationGraceMs: 500 },
    );
    let settled = false;
    const observed = running.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    try {
      await vi.waitFor(async () => {
        const pid = Number(await readFile(childPidFile, 'utf8'));
        expect(pid).toBeGreaterThan(0);
      });
      const descendantPid = Number(await readFile(childPidFile, 'utf8'));
      controller.abort();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(settled).toBe(false);
      await expect(running).rejects.toThrow();
      await observed;
      await vi.waitFor(
        () => {
          let alive = true;
          try {
            process.kill(descendantPid, 0);
          } catch {
            alive = false;
          }
          expect(alive).toBe(false);
        },
        { timeout: 5000 },
      );
    } finally {
      controller.abort();
      await rm(root, { recursive: true, force: true });
    }
  },
);

it('keeps a paired device and its registered project across launcher restarts', async () => {
  const root = await temporaryRoot('porcelain-serve-restart-');
  const project = join(root, 'project');
  const state = join(root, 'state');
  const webRoot = join(root, 'web');
  const settings: ServeSettings = {
    dataDirectory: state,
    projectHome: join(root, 'home'),
    host: '127.0.0.1',
    port: 0,
    webRoot,
    allowedHosts: [],
  };
  const buildWeb = vi.fn(async () => {
    await mkdirForTest(webRoot);
  });
  try {
    execFileSync('git', ['init', '-b', 'main', project], {
      env: {
        PATH: process.env.PATH,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
      },
    });
    const firstController = new AbortController();
    const firstOutput: string[] = [];
    const first = runServe(settings, firstController.signal, {
      buildWeb,
      output: (line) => firstOutput.push(line),
    });
    await vi.waitFor(() =>
      expect(firstOutput[0]).toMatch(/^Porcelain listening at /),
    );
    const firstLine = firstOutput[0];
    if (!firstLine) throw new Error('Launcher did not print an address');
    const firstAddress = firstLine.slice('Porcelain listening at '.length);
    // Access is a device this run pairs for itself through the owner socket;
    // the launcher leaves no shared credential on disk to read.
    const credential = await pairThroughSocket(
      join(state, 'server.sock'),
      firstAddress,
      'Launcher fixture',
    );
    const response = await fetch(`${firstAddress}/api/projects`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credential}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ path: project }),
    });
    expect(response.status).toBe(200);
    firstController.abort();
    await first;

    const secondController = new AbortController();
    const secondOutput: string[] = [];
    const second = runServe(settings, secondController.signal, {
      buildWeb,
      output: (line) => secondOutput.push(line),
    });
    await vi.waitFor(() =>
      expect(secondOutput[0]).toMatch(/^Porcelain listening at /),
    );
    const secondLine = secondOutput[0];
    if (!secondLine) throw new Error('Launcher did not print an address');
    const secondAddress = secondLine.slice('Porcelain listening at '.length);
    const inventory = await fetch(`${secondAddress}/api/inventory`, {
      headers: { authorization: `Bearer ${credential}` },
    });
    expect(inventory.status).toBe(200);
    expect(
      ((await inventory.json()) as { projects: unknown[] }).projects,
    ).toHaveLength(1);
    secondController.abort();
    await second;
    expect(buildWeb).toHaveBeenCalledTimes(2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function mkdirForTest(path: string) {
  await mkdir(path, { recursive: true });
  await writeFile(join(path, 'index.html'), '<html>test</html>');
}
