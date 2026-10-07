import { Schema } from 'effect';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import { repositoryRoot } from '../../../../.agents/skills/verify-core/registry.ts';
import {
  desktopConnectionSchema,
  startDesktop,
} from '../../../../.agents/skills/desktop-verify/scripts/start.ts';

const launcher = join(
  repositoryRoot,
  '.agents/skills/desktop-verify/scripts/cli',
);
const CAN_LAUNCH =
  process.platform === 'darwin' ||
  (process.platform === 'linux' &&
    Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY));
const LAUNCH_WITHIN_MS = 120_000;

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

test.each(['snapshot', 'menu', 'window', 'dialog'])(
  'retires renderer and native CLI driver %s',
  async (command) => {
    const refused = await cli(command);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(
      'Drive the renderer through the published CDP endpoint or Computer Use.',
    );
  },
);

test.runIf(CAN_LAUNCH)(
  'the shared lifecycle publishes a private card and exposes raw Electron and renderer tools, then stops both owned processes',
  async ({ onTestFinished }) => {
    const folder = await mkdtemp('/tmp/porcelain-desktop-lifecycle-');
    const evidenceDirectory = join(folder, 'evidence');
    await mkdir(evidenceDirectory);
    onTestFinished(() => rm(folder, { recursive: true, force: true }));
    const opened = await startDesktop({
      id: '1234abcd',
      folder,
      evidenceDirectory,
      sourceFingerprint: 'integration',
    });
    onTestFinished(() => opened.stop());
    const card = Schema.decodeUnknownSync(desktopConnectionSchema)(
      JSON.parse(await readFile(join(folder, 'connection.json'), 'utf8')),
    );
    expect(card.app.productName).toBe('Porcelain Dev');
    expect(card.app.stagedPath).toBe(join(folder, 'app'));
    expect(card.rendererUrl).toBe('porcelain://app/');
    expect(card.build.sourceFingerprint).toBe('integration');
    expect(card.electron.lifecycleEntryPoint).toContain(
      '/desktop-verify/scripts/start.ts#startDesktop',
    );
    expect((await stat(join(folder, 'connection.json'))).mode & 0o777).toBe(
      0o600,
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
        ?.getByRole('button', { name: 'Open project', exact: true })
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
    expect(existsSync(card.app.profilePath)).toBe(false);
    expect(existsSync(join(evidenceDirectory, 'server.log'))).toBe(true);
  },
  LAUNCH_WITHIN_MS,
);

test.runIf(CAN_LAUNCH)(
  'the desktop launcher prints its connection, reports passive windows and retains evidence after a repeatable stop',
  async ({ onTestFinished }) => {
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
    expect(started.stdout).toContain(
      `renderer CDP ${card.rendererCdpEndpoint}`,
    );
    expect(started.stdout).toContain(`pair ${card.pairing.command}`);
    expect(card.app.stagedPath).toBe(join(dirname(connectionPath), 'app'));
    const status = await cli('status', '--instance', id);
    expect(status.code, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({
      alive: true,
      stale: null,
      windows: [{ type: 'page', url: 'porcelain://app/' }],
    });
    const stopped = await cli('stop', '--instance', id);
    expect(stopped.code, stopped.stderr + stopped.stdout).toBe(0);
    expect(stopped.stdout).toContain(`stopped ${id}`);
    expect(alive(card.app.pid)).toBe(false);
    expect(alive(card.app.serverPid)).toBe(false);
    expect(existsSync(dirname(connectionPath))).toBe(false);
    expect(existsSync(card.app.profilePath)).toBe(false);
    expect(existsSync(join(card.evidenceDirectory, 'server.log'))).toBe(true);
    const retained = await cli('evidence', '--instance', id);
    expect(retained.code).toBe(0);
    expect(retained.stdout.trim()).toBe(card.evidenceDirectory);
    const repeated = await cli('stop', '--instance', id);
    expect(repeated.code).toBe(0);
    expect(repeated.stdout).toContain(`already stopped ${id}`);
  },
  LAUNCH_WITHIN_MS,
);
