import { execFileSync } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import {
  ensureAccessToken,
  parseServeSettings,
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
    expect(parseServeSettings([], {}, home)).toEqual({
      dataDirectory: join(home, '.porcelain'),
      tokenFile: join(home, '.porcelain', 'admin-token'),
      host: '127.0.0.1',
      port: 3000,
      webRoot: expect.stringContaining('/apps/web/dist'),
    });
    expect(
      parseServeSettings(
        [
          '--',
          '--lan',
          '--port=4321',
          '--data-directory',
          join(home, 'state'),
          '--token-file',
          join(home, 'credentials', 'token'),
        ],
        {},
        home,
      ),
    ).toMatchObject({
      dataDirectory: join(home, 'state'),
      tokenFile: join(home, 'credentials', 'token'),
      host: '0.0.0.0',
      port: 4321,
    });
    expect(() =>
      parseServeSettings(['--lan', '--host', '127.0.0.1'], {}, home),
    ).toThrow(ServeConfigurationError);
    expect(() => parseServeSettings(['--port', '65536'], {}, home)).toThrow(
      'integer from 0 to 65535',
    );
    expect(() =>
      parseServeSettings(['--data-directory', 'relative'], {}, home),
    ).toThrow('absolute path');
    expect(() => parseServeSettings(['--unknown'], {}, home)).toThrow(
      'Unknown option',
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

it('creates a mode-0600 token once and safely reuses it', async () => {
  const root = await temporaryRoot('porcelain-serve-token-');
  const tokenFile = join(root, 'nested', 'admin-token');
  try {
    const first = await ensureAccessToken(tokenFile);
    expect(first).toHaveLength(43);
    expect(await readFile(tokenFile, 'utf8')).toBe(first);
    expect((await stat(tokenFile)).mode & 0o777).toBe(0o600);
    await chmod(tokenFile, 0o644);
    await expect(ensureAccessToken(tokenFile)).resolves.toBe(first);
    expect((await stat(tokenFile)).mode & 0o777).toBe(0o600);
    expect(await ensureAccessToken(tokenFile)).toBe(first);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects weak or symlinked token files', async () => {
  const root = await temporaryRoot('porcelain-serve-token-invalid-');
  const weak = join(root, 'weak-token');
  const target = join(root, 'target-token');
  const link = join(root, 'link-token');
  try {
    await writeFile(weak, 'too-short', { mode: 0o600 });
    await expect(ensureAccessToken(weak)).rejects.toThrow('strong token');
    await writeFile(target, 'a'.repeat(43), { mode: 0o600 });
    await symlink(target, link);
    await expect(ensureAccessToken(link)).rejects.toThrow('regular file');
  } finally {
    await rm(root, { recursive: true, force: true });
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

it('keeps the persistent token and registered project across launcher restarts', async () => {
  const root = await temporaryRoot('porcelain-serve-restart-');
  const project = join(root, 'project');
  const state = join(root, 'state');
  const webRoot = join(root, 'web');
  const tokenFile = join(state, 'admin-token');
  const settings: ServeSettings = {
    dataDirectory: state,
    tokenFile,
    host: '127.0.0.1',
    port: 0,
    webRoot,
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
    const token = await readFile(tokenFile, 'utf8');
    const response = await fetch(`${firstAddress}/projects`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
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
    const inventory = await fetch(`${secondAddress}/inventory`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(inventory.status).toBe(200);
    expect(
      ((await inventory.json()) as { projects: unknown[] }).projects,
    ).toHaveLength(1);
    expect(await readFile(tokenFile, 'utf8')).toBe(token);
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
