import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { _electron, type Page } from 'playwright';
import { z } from 'zod';
import { askOwner } from '../apps/server/src/cli/owner-client.ts';

type DesktopProof = {
  executable: string;
  profile: string;
  repository: string;
  evidence: string;
};
const ownerStatus = z.object({ pid: z.number(), address: z.string() });
const inventory = z.object({
  projects: z.array(
    z.object({ worktrees: z.array(z.object({ path: z.string() })) }),
  ),
});
const access = z.object({ devices: z.array(z.object({ id: z.string() })) });

function requireProof(condition: boolean, promise: string) {
  if (!condition) throw new Error(promise);
}

export const desktopFeatures = [
  {
    name: 'installed-project',
    promise:
      'the installed app starts its own server, opens a real Git project, survives window close, reopens from the Dock, retains its project and pairing after restart, and stops its server on Quit',
    run: installedProject,
  },
];

async function installedProject(input: DesktopProof) {
  const errors: string[] = [];
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env))
    if (value !== undefined && name !== 'ELECTRON_RUN_AS_NODE')
      environment[name] = value;
  const launch = () =>
    _electron.launch({
      executablePath: input.executable,
      args: [
        '--data-directory',
        input.profile,
        '--project-home',
        input.repository,
      ],
      env: environment,
      timeout: 30_000,
    });
  const app = await launch();
  app
    .process()
    .stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
  const data = join(input.profile, 'server');
  let serverPid: number | undefined;
  let visiblePage: Page | undefined;
  try {
    const page = await app.firstWindow({ timeout: 30_000 });
    visiblePage = page;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForURL((url) => url.pathname !== '/pair', {
      timeout: 30_000,
    });
    const status = ownerStatus.parse(
      await askOwner(data, 'GET', '/status', undefined, 5000),
    );
    serverPid = status.pid;
    requireProof(
      new URL(status.address).hostname === '127.0.0.1',
      'The app server must listen only on loopback',
    );
    await page
      .getByRole('button', { name: 'Open project', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Open project' });
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: 'Enter a path' }).click();
    await dialog
      .getByRole('textbox', { name: 'Repository path' })
      .fill(input.repository);
    await dialog
      .getByRole('button', { name: 'Open project', exact: true })
      .click();
    await dialog.waitFor({ state: 'hidden' });
    await page
      .getByRole('button', { name: 'desktop-smoke', exact: true })
      .waitFor();
    const opened: unknown = await page.evaluate(async () =>
      (
        await fetch('/api/inventory', {
          credentials: 'same-origin',
          headers: { 'x-porcelain-browser': '1' },
        })
      ).json(),
    );
    requireProof(
      inventory
        .parse(opened)
        .projects.some((project) =>
          project.worktrees.some(
            (worktree) => worktree.path === input.repository,
          ),
        ),
      'The real server must persist the opened project',
    );
    await page.screenshot({
      path: join(input.evidence, 'installed-project.png'),
    });
    requireProof(
      existsSync(join(data, 'inventory.sqlite')),
      'The Electron server must create its SQLite database',
    );
    const windowClosed = page.waitForEvent('close');
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close();
    });
    await windowClosed;
    requireProof(
      app.windows().length === 0,
      'Closing the window must close the window',
    );
    requireProof(
      ownerStatus.parse(await askOwner(data, 'GET', '/status', undefined, 5000))
        .pid === serverPid,
      'Closing the last window must keep the same server running',
    );
    const reopened = app.waitForEvent('window');
    await app.evaluate(({ app: electronApp }) => {
      electronApp.emit('activate');
    });
    const view = await reopened;
    await view
      .getByRole('button', { name: 'desktop-smoke', exact: true })
      .waitFor();
    process.stdout.write(
      'Desktop proof: project opened, window reopened; checking Quit\n',
    );
    await closeDesktop(app);
    requireProof(
      !existsSync(join(data, 'server.sock')),
      'Quit must remove the owner socket',
    );
    requireProof(!processAlive(serverPid), 'Quit must stop the managed server');
    const restarted = await launch();
    try {
      const restored = await restarted.firstWindow({ timeout: 30_000 });
      await restored
        .getByRole('button', { name: 'desktop-smoke', exact: true })
        .waitFor();
      const pairing = access.parse(
        await askOwner(data, 'GET', '/access', undefined, 5000),
      );
      requireProof(
        pairing.devices.length === 1,
        'Restarting must reuse the existing desktop pairing',
      );
      const next = ownerStatus.parse(
        await askOwner(data, 'GET', '/status', undefined, 5000),
      );
      serverPid = next.pid;
    } finally {
      await closeDesktop(restarted);
    }
    requireProof(
      !processAlive(serverPid),
      'Quit after restart must stop the new server',
    );
    requireProof(errors.length === 0, `Renderer errors: ${errors.join('; ')}`);
    return {
      openedProject: true,
      nativeDatabase: true,
      closeKeepsServer: true,
      dockReopens: true,
      restartKeepsProjectAndPairing: true,
      quitStopsServer: true,
    };
  } catch (error) {
    if (visiblePage !== undefined && !visiblePage.isClosed()) {
      await visiblePage
        .screenshot({ path: join(input.evidence, 'failure.png') })
        .catch(() => undefined);
      await writeFile(
        join(input.evidence, 'renderer.txt'),
        await visiblePage
          .locator('body')
          .innerText({ timeout: 5000 })
          .catch(() => 'The renderer did not answer'),
      );
    }
    await writeFile(
      join(input.evidence, 'failure.txt'),
      `${error instanceof Error ? error.message : 'Desktop proof failed'}\n`,
    );
    throw error;
  } finally {
    await closeDesktop(app).catch(() => {
      app.process().kill('SIGKILL');
    });
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function closeDesktop(app: Awaited<ReturnType<typeof _electron.launch>>) {
  const timeout = AbortSignal.timeout(15_000);
  const expired = new Promise<never>((_resolve, reject) => {
    timeout.addEventListener(
      'abort',
      () => reject(new Error('The app did not quit after stopping its server')),
      { once: true },
    );
  });
  await Promise.race([app.close(), expired]);
}
