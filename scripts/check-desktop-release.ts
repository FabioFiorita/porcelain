import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout } from 'node:timers/promises';
import { chromium } from 'playwright';

const image = process.argv[2];
if (!image) throw new Error('Pass the signed Porcelain disk image');

const workspace = mkdtempSync(join(tmpdir(), 'porcelain-release-'));
const mount = join(workspace, 'image');
const profile = join(workspace, 'profile');
const projects = join(workspace, 'projects');
const home = join(workspace, 'home');
let mounted = false;

try {
  for (const path of [mount, profile, projects, home]) mkdirSync(path);
  execFileSync(
    'hdiutil',
    ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, image],
    { stdio: 'inherit' },
  );
  mounted = true;
  const app = spawn(
    join(mount, 'Porcelain.app', 'Contents', 'MacOS', 'Porcelain'),
    [
      '--data-directory',
      profile,
      '--project-home',
      projects,
      `--user-data-dir=${profile}`,
      '--remote-debugging-port=0',
    ],
    {
      env: {
        ...process.env,
        HOME: home,
        PORCELAIN_CODING_TOOL_DIRECTORY: 'none',
      },
      stdio: ['ignore', 'inherit', 'pipe'],
    },
  );
  const exited = new Promise<void>((resolve) =>
    app.once('close', () => resolve()),
  );
  const endpoint = new Promise<string>((resolve, reject) => {
    app.once('error', reject);
    app.once('exit', (code, signal) =>
      reject(
        new Error(
          `Porcelain exited before opening its renderer (${code ?? signal})`,
        ),
      ),
    );
    createInterface({ input: app.stderr }).on('line', (line) => {
      const address =
        /^DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/\S+)$/.exec(
          line,
        )?.[1];
      if (address) resolve(address);
      else process.stderr.write(`${line}\n`);
    });
  });
  try {
    const address = await Promise.race([
      endpoint,
      setTimeout(30_000, undefined, { ref: false }).then(() => {
        throw new Error(
          'Porcelain did not open its renderer debugging endpoint',
        );
      }),
    ]);
    const browser = await chromium.connectOverCDP(address, { timeout: 10_000 });
    try {
      const context = browser.contexts()[0];
      if (!context) throw new Error('Porcelain did not open a browser context');
      const page =
        context.pages()[0] ??
        (await context.waitForEvent('page', { timeout: 30_000 }));
      await page.waitForURL(
        (url) =>
          url.protocol === 'porcelain:' &&
          url.hostname === 'app' &&
          url.pathname !== '/pair',
        { timeout: 30_000 },
      );
      await page
        .getByRole('navigation', {
          name: 'Projects and worktrees',
          exact: true,
        })
        .getByRole('button', { name: 'Open project', exact: true })
        .waitFor({ state: 'visible', timeout: 30_000 });
      console.log('The mounted Porcelain app opened its project sidebar.');
    } finally {
      await browser.close();
    }
  } finally {
    app.kill();
    const stopped = await Promise.race([
      exited.then(() => true),
      setTimeout(5_000, false, { ref: false }),
    ]);
    if (!stopped) {
      app.kill('SIGKILL');
      await exited;
    }
  }
} finally {
  if (mounted) execFileSync('hdiutil', ['detach', mount], { stdio: 'inherit' });
  rmSync(workspace, { recursive: true, force: true });
}
