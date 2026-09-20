import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildPackage, packageOutput } from './build-package.ts';

const enabled = process.env.PORCELAIN_PACKAGE_ACCEPTANCE === '1';
const packageAcceptance = enabled ? it : it.skip;

type RunningServer = {
  child: ChildProcess;
  address: string;
  output: { stdout: string; stderr: string };
};

function isolatedGitEnvironment() {
  return {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
  };
}

async function waitForListening(
  child: ChildProcess,
  output: { stdout: string; stderr: string },
): Promise<string> {
  return new Promise<string>((resolveAddress, reject) => {
    let timer: NodeJS.Timeout | undefined;
    let settled = false;
    const onStdout = (chunk: string) => {
      output.stdout += chunk;
      if (settled) return;
      const newline = output.stdout.lastIndexOf('\n');
      if (newline < 0) return;
      const line = output.stdout
        .slice(0, newline)
        .split('\n')
        .find((value) => value.startsWith('Porcelain listening at '));
      if (!line) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolveAddress(line.slice('Porcelain listening at '.length).trim());
    };
    const onStderr = (chunk: string) => {
      output.stderr += chunk;
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      child.stdout?.off('data', onStdout);
      child.stderr?.off('data', onStderr);
      child.off('error', onError);
      child.off('close', onClose);
    };
    const fail = (error: Error) => {
      if (settled) {
        cleanup();
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    const onError = (error: Error) => fail(error);
    const onClose = (code: number | null) => {
      if (settled) {
        cleanup();
        return;
      }
      fail(
        new Error(
          `Package launcher exited before listening (${code ?? 'unknown'}): ${output.stderr}`,
        ),
      );
    };
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', onStdout);
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', onStderr);
    child.once('error', onError);
    child.once('close', onClose);
    timer = setTimeout(
      () =>
        fail(
          new Error(
            `Timed out waiting for server: ${output.stdout}\n${output.stderr}`,
          ),
        ),
      15_000,
    );
  });
}

async function stopServer(server: RunningServer): Promise<void> {
  if (server.child.exitCode !== null || server.child.signalCode !== null)
    return;
  const exited = new Promise<number | null>((resolveExit) =>
    server.child.once('close', resolveExit),
  );
  server.child.kill('SIGTERM');
  expect(await exited).toBe(0);
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolveExit) =>
    child.once('close', () => resolveExit()),
  );
  child.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
  ]);
}

packageAcceptance(
  'packs and installs the executable outside the checkout, serves an absolute repository, and persists it across restart',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-package-acceptance-'));
    const children: ChildProcess[] = [];
    try {
      if (process.env.PORCELAIN_PACKAGE_ACCEPTANCE_REUSE_BUILD !== '1')
        await buildPackage();
      const packed = JSON.parse(
        execFileSync('npm', ['pack', '--json', '--pack-destination', root], {
          cwd: packageOutput,
          encoding: 'utf8',
        }),
      ) as Array<{ filename: string }>;
      const archive = packed[0]?.filename;
      if (!archive) throw new Error('npm pack did not report an archive');

      const install = join(root, 'consumer');
      const cwd = join(root, 'unrelated-cwd');
      const project = join(root, 'repository');
      const state = join(root, 'state');
      const tokenFile = join(root, 'credentials', 'token');
      await mkdir(install, { recursive: true });
      await mkdir(cwd, { recursive: true });
      await writeFile(
        join(install, 'package.json'),
        JSON.stringify({ name: 'porcelain-consumer', private: true }),
      );
      await writeFile(join(cwd, '.keep'), '');
      execFileSync('git', ['init', '-b', 'main', project], {
        env: isolatedGitEnvironment(),
      });
      execFileSync(
        'npm',
        [
          'install',
          '--no-audit',
          '--no-fund',
          '--package-lock=false',
          join(root, archive),
        ],
        {
          cwd: install,
          env: { ...process.env, npm_config_update_notifier: 'false' },
          stdio: 'inherit',
        },
      );

      const bin = join(install, 'node_modules/.bin/porcelain');
      expect((await lstat(bin)).isSymbolicLink()).toBe(true);
      expect(await readlink(bin)).toContain('bin/porcelain.js');

      const launch = () => {
        const output = { stdout: '', stderr: '' };
        const child = spawn(
          bin,
          [
            'serve',
            '--data-directory',
            state,
            '--token-file',
            tokenFile,
            '--port',
            '0',
          ],
          {
            cwd,
            env: isolatedGitEnvironment(),
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
        children.push(child);
        return { child, output, listening: waitForListening(child, output) };
      };

      const ownerStatus = () => {
        try {
          return {
            code: 0,
            output: execFileSync(bin, ['status', '--data-directory', state], {
              cwd,
              env: isolatedGitEnvironment(),
              encoding: 'utf8',
            }),
          };
        } catch (error) {
          const failure = error as { status?: number; stdout?: string };
          return { code: failure.status ?? -1, output: failure.stdout ?? '' };
        }
      };

      // Nothing has run here yet: that is an answer, with its own exit code.
      expect(ownerStatus()).toMatchObject({ code: 1, output: /not running/ });

      const firstLaunch = launch();
      const firstAddress = await firstLaunch.listening;
      expect(ownerStatus()).toMatchObject({ code: 0, output: /is running/ });
      const token = (await readFile(tokenFile, 'utf8')).trim();
      const headers = { authorization: `Bearer ${token}` };
      expect((await fetch(`${firstAddress}/`)).status).toBe(200);
      expect((await fetch(`${firstAddress}/api/inventory`)).status).toBe(401);
      const mcp = await fetch(`${firstAddress}/api/mcp`, {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'package-test', version: '1' },
          },
        }),
      });
      expect(mcp.status).toBe(200);
      expect(await mcp.json()).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: { serverInfo: { name: 'porcelain' } },
      });
      const registered = await fetch(`${firstAddress}/api/projects`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ path: project }),
      });
      expect(registered.status).toBe(200);
      const projectResponse = (await registered.json()) as {
        worktrees: Array<{ id: string }>;
      };
      const worktree = projectResponse.worktrees[0];
      if (!worktree)
        throw new Error('Project registration returned no worktree');
      const inventory = await fetch(`${firstAddress}/api/inventory`, {
        headers,
      });
      expect(inventory.status).toBe(200);
      expect(
        ((await inventory.json()) as { projects: unknown[] }).projects,
      ).toHaveLength(1);
      const status = await fetch(
        `${firstAddress}/api/worktrees/${worktree.id}/git/status`,
        { headers },
      );
      expect(status.status).toBe(200);
      const reviewLayers = await fetch(
        `${firstAddress}/api/worktrees/${worktree.id}/review-layers`,
        { headers },
      );
      expect(reviewLayers.status).toBe(200);
      await stopServer({
        child: firstLaunch.child,
        address: firstAddress,
        output: firstLaunch.output,
      });
      expect(ownerStatus()).toMatchObject({ code: 1, output: /not running/ });

      const secondLaunch = launch();
      const secondAddress = await secondLaunch.listening;
      const persisted = await fetch(`${secondAddress}/api/inventory`, {
        headers,
      });
      expect(persisted.status).toBe(200);
      expect(
        ((await persisted.json()) as { projects: unknown[] }).projects,
      ).toHaveLength(1);
      await stopServer({
        child: secondLaunch.child,
        address: secondAddress,
        output: secondLaunch.output,
      });
      expect(
        firstLaunch.output.stdout +
          firstLaunch.output.stderr +
          secondLaunch.output.stdout +
          secondLaunch.output.stderr,
      ).not.toContain(token);
    } finally {
      for (const child of children) await stopChild(child);
      await rm(root, { recursive: true, force: true });
    }
  },
  120_000,
);
