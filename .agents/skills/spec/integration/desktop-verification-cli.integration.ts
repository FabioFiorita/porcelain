import { Schema } from 'effect';
import { stageDesktop } from '@porcelain/desktop/kit/stage';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { beforeAll, afterAll, expect, type TestContext } from 'vitest';
import { test } from '@porcelain/server/kit/server-test';
import { repositoryRoot } from '../../verify-core/registry.ts';
import {
  desktopConnectionSchema,
  startDesktop,
} from '../../desktop-verify/scripts/start.ts';

const launcher = join(
  repositoryRoot,
  '.agents/skills/desktop-verify/scripts/cli',
);
const CAN_LAUNCH =
  process.platform === 'darwin' ||
  (process.platform === 'linux' &&
    Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY));
const LAUNCH_WITHIN_MS = 120_000;

const originalPath = process.env.PATH;
let rendererFixture: string | undefined;
beforeAll(async () => {
  if (!CAN_LAUNCH) return;
  rendererFixture = await mkdtemp('/tmp/porcelain-desktop-renderer-');
  const artifact = join(rendererFixture, 'app');
  await stageDesktop({
    directory: artifact,
    productName: 'Porcelain Dev',
    web: true,
  });
  const bin = join(rendererFixture, 'bin');
  await mkdir(bin);
  await writeFile(
    join(bin, 'pnpm'),
    `#!${process.execPath}
import assert from 'node:assert/strict';
import { cp } from 'node:fs/promises';
const args = process.argv.slice(2);
assert.deepEqual(args.slice(0, 7), ['--filter', '@porcelain/web', 'exec', 'vite', 'build', '--mode', 'desktop']);
const at = args.indexOf('--outDir');
assert.ok(at >= 0 && args[at + 1]);
await cp(${JSON.stringify(join(artifact, 'web'))}, args[at + 1], { recursive: true });
`,
    { mode: 0o700 },
  );
  process.env.PATH = `${bin}${delimiter}${originalPath ?? ''}`;
});
afterAll(async () => {
  process.env.PATH = originalPath;
  if (rendererFixture !== undefined)
    await rm(rendererFixture, { recursive: true, force: true });
});

function cli(...args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (done) => {
      execFile(
        launcher,
        args,
        { cwd: repositoryRoot, timeout: LAUNCH_WITHIN_MS },
        (error, stdout, stderr) => {
          done({
            code: error === null ? 0 : Number(error.code ?? 1),
            stdout,
            stderr,
          });
        },
      );
    },
  );
}

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test.runIf(CAN_LAUNCH)(
  'the shared lifecycle exposes raw Electron and renderer tools, then removes its owned runtime and keeps evidence',
  async ({ onTestFinished }) => {
    const evidenceDirectory = await mkdtemp('/tmp/porcelain-desktop-evidence-');
    onTestFinished(() =>
      rm(evidenceDirectory, { recursive: true, force: true }),
    );
    const opened = await startDesktop({
      id: '1234abcd',
      evidenceDirectory,
      sourceFingerprint: 'integration',
    });
    onTestFinished(() => opened.stop());
    const card = Schema.decodeUnknownSync(desktopConnectionSchema)(opened.card);
    expect(card.app.productName).toBe('Porcelain Dev');
    const workspace = dirname(card.app.profilePath);
    expect(card.app.stagedPath).toBe(join(workspace, 'app'));
    expect(card.rendererUrl).toBe('porcelain://app/');
    expect(card.build.sourceFingerprint).toBe('integration');
    expect(card.electron.lifecycleEntryPoint).toContain(
      '/desktop-verify/scripts/start.ts#startDesktop',
    );
    expect((await stat(card.electron.launchOptionsFile)).mode & 0o777).toBe(
      0o600,
    );
    expect(
      await opened.electron.evaluate(({ app }) => ({
        packaged: app.isPackaged,
        profile: app.getPath('userData'),
      })),
    ).toEqual({ packaged: false, profile: card.app.profilePath });
    const renderer = await opened.electron.firstWindow();
    expect(
      await renderer.evaluate(() => {
        const bridge: unknown = Reflect.get(globalThis, 'porcelainDesktop');
        return (
          typeof bridge === 'object' &&
          bridge !== null &&
          typeof Reflect.get(bridge, 'pickProjectFolder') === 'function'
        );
      }),
    ).toBe(true);
    const browser = await chromium.connectOverCDP(card.rendererCdpEndpoint);
    try {
      const pages = browser.contexts().flatMap((context) => context.pages());
      expect(pages.map((page) => page.url())).toContain('porcelain://app/');
      const page = pages.find((page) => page.url() === card.rendererUrl);
      expect(page).toBeDefined();
      await page
        ?.getByTestId('document')
        .getByRole('button', { name: 'Open project', exact: true })
        .waitFor();
    } finally {
      await browser.close();
    }
    const health = await fetch(`${card.serverUrl}/api/health`);
    expect(health.status).toBe(200);
    expect(health.headers.get('content-type')).toContain('application/json');
    expect(alive(card.app.pid)).toBe(true);
    expect(alive(card.app.serverPid)).toBe(true);
    await opened.stop();
    expect(alive(card.app.pid)).toBe(false);
    expect(alive(card.app.serverPid)).toBe(false);
    expect(existsSync(card.ownerSocketPath)).toBe(false);
    expect(existsSync(workspace)).toBe(false);
    expect(existsSync(card.app.profilePath)).toBe(false);
    expect(existsSync(card.app.stagedPath)).toBe(false);
    expect(existsSync(card.electron.launchOptionsFile)).toBe(false);
    expect(existsSync(join(evidenceDirectory, 'server.log'))).toBe(true);
    await opened.stop();
    expect(existsSync(workspace)).toBe(false);
  },
);

async function launched(onTestFinished: TestContext['onTestFinished']) {
  const started = await cli('start');
  expect(started.code, started.stderr).toBe(0);
  const [, id = ''] = /^instance ([a-f0-9]{8})\n/.exec(started.stdout) ?? [];
  onTestFinished(async () => {
    await cli('stop', '--instance', id);
  });
  const [, connectionPath = ''] =
    /\nconnection (.+)\n/.exec(started.stdout) ?? [];
  const card = Schema.decodeUnknownSync(desktopConnectionSchema)(
    JSON.parse(await readFile(connectionPath, 'utf8')),
  );
  return { started, id, connectionPath, card };
}

test.runIf(CAN_LAUNCH)(
  'the desktop launcher prints its private connection and reports passive windows',
  async ({ onTestFinished }) => {
    const { started, id, connectionPath, card } =
      await launched(onTestFinished);
    expect(started.stdout).toContain(
      `renderer CDP ${card.rendererCdpEndpoint}`,
    );
    expect(started.stdout).toContain(`pair ${card.pairing.command}`);
    expect(card.app.stagedPath).toBe(
      join(dirname(card.app.profilePath), 'app'),
    );
    expect((await stat(connectionPath)).mode & 0o777).toBe(0o600);
    const status = await cli('status', '--instance', id);
    expect(status.code, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({
      alive: true,
      stale: null,
      windows: [{ type: 'page', url: 'porcelain://app/' }],
    });
  },
);

test.runIf(CAN_LAUNCH)(
  'the desktop launcher retains evidence after a repeatable stop',
  async ({ onTestFinished }) => {
    const { id, connectionPath, card } = await launched(onTestFinished);
    const stopped = await cli('stop', '--instance', id);
    expect(stopped.code, stopped.stderr + stopped.stdout).toBe(0);
    expect(stopped.stdout).toContain(`stopped ${id}`);
    expect(alive(card.app.pid)).toBe(false);
    expect(alive(card.app.serverPid)).toBe(false);
    expect(existsSync(dirname(connectionPath))).toBe(false);
    expect(existsSync(card.app.profilePath)).toBe(false);
    expect(existsSync(join(card.evidenceDirectory, 'server.log'))).toBe(true);
    const repeated = await cli('stop', '--instance', id);
    expect(repeated.code).toBe(0);
    expect(repeated.stdout).toContain(`already stopped ${id}`);
  },
);
