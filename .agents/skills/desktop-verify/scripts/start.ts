import { Schema } from 'effect';
import { readHealthResponseSchema } from '@porcelain/contracts/access';
import { launchOptions, sampleRepository } from '@porcelain/desktop/kit/launch';
import { electronExecutable, stageDesktop } from '@porcelain/desktop/kit/stage';
import { ownerStatus } from '@porcelain/server/kit/owner';
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { cp, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFingerprint } from '../../verify-core/fingerprint.ts';
import { _electron } from 'playwright';
import { freePort, onPath } from '../../verify-core/cli.ts';
import {
  buildIdentity,
  connectionSchema,
  shellCommand,
} from '../../verify-core/connection.ts';
import { repositoryRoot } from '../../verify-core/registry.ts';

export const desktopInputs = {
  roots: [
    'apps/desktop/src',
    'apps/desktop/spec/kit',
    'apps/web/src',
    'apps/web/public',
    'apps/web/index.html',
    'apps/web/vite.config.ts',
  ],
  apps: ['apps/desktop', 'apps/web'],
};

export const desktopConnectionSchema = Schema.Struct({
  ...connectionSchema.fields,
  app: Schema.Struct({
    productName: Schema.String,
    osName: Schema.String,
    executablePath: Schema.String,
    bundlePath: Schema.NullOr(Schema.String),
    pid: Schema.Number,
    serverPid: Schema.Number,
    profilePath: Schema.String,
    stagedPath: Schema.String,
  }),
  rendererUrl: Schema.String,
  rendererCdpEndpoint: Schema.String,
  electron: Schema.Struct({
    launchOptionsFile: Schema.String,
    lifecycleEntryPoint: Schema.String,
  }),
  capabilities: Schema.Struct({ macOSOnly: Schema.Array(Schema.String) }),
});

export function desktopProblems(): string[] {
  const problems: string[] = [];
  try {
    if (!existsSync(electronExecutable())) throw new Error('missing');
  } catch {
    problems.push(
      'Electron is missing for apps/desktop; run pnpm install --frozen-lockfile with the project toolchain. Do not change install policy.',
    );
  }
  for (const tool of ['git', 'ps', 'pnpm'])
    if (!onPath(tool)) problems.push(`${tool} is missing from PATH`);
  if (
    process.platform === 'linux' &&
    !process.env.DISPLAY &&
    !process.env.WAYLAND_DISPLAY
  )
    problems.push(
      'No display is configured; run xvfb-run -a .agents/skills/desktop-verify/scripts/cli start (requires xvfb), or use a desktop session.',
    );
  if (process.platform !== 'darwin' && process.platform !== 'linux')
    problems.push('The desktop launcher supports macOS and Linux');
  return problems;
}

export async function startDesktop(input: {
  id: string;
  folder: string;
  evidenceDirectory: string;
  sourceFingerprint?: string;
  own?: (pid: number) => void;
  onStop?: (stop: () => Promise<void>) => void;
}) {
  const workspace = await realpath(await mkdtemp('/tmp/porcelain-desktop-'));
  const stagedPath = join(input.folder, 'app');
  const profilePath = join(workspace, 'profile');
  let electron: Awaited<ReturnType<typeof _electron.launch>> | undefined;
  let child: ReturnType<NonNullable<typeof electron>['process']> | undefined;
  let awake: ReturnType<typeof spawn> | undefined;
  let stopped: Promise<void> | undefined;
  const stop = () =>
    (stopped ??= (async () => {
      if (
        electron !== undefined &&
        child !== undefined &&
        child.exitCode === null &&
        child.signalCode === null
      ) {
        const running = electron;
        const captured = child;
        const exited = new Promise<void>((done) =>
          captured.once('close', () => done()),
        );
        const deadline = setTimeout(() => captured.kill('SIGKILL'), 15_000);
        try {
          await running
            .evaluate(({ app }) => app.quit())
            .catch((error: unknown) => {
              if (
                !(error instanceof Error) ||
                (!error.message.includes('closed') &&
                  !error.message.includes('Execution context was destroyed'))
              )
                throw error;
            });
          await exited;
          await running.close();
        } finally {
          clearTimeout(deadline);
        }
      }
      if (
        child !== undefined &&
        (child.exitCode !== 0 || child.signalCode !== null)
      )
        throw new Error(
          `Porcelain Dev did not exit cleanly: ${child.exitCode}, ${child.signalCode}; private runtime kept`,
        );
      const log = join(profilePath, 'logs/server.log');
      if (existsSync(log))
        await cp(log, join(input.evidenceDirectory, 'server.log'));
      if (awake !== undefined) awake.kill('SIGTERM');
      await rm(workspace, { recursive: true, force: true });
    })());
  input.onStop?.(stop);
  try {
    if (process.platform === 'darwin') {
      awake = spawn('caffeinate', ['-d', '-u', '-w', String(process.pid)], {
        stdio: 'ignore',
      });
      if (awake.pid !== undefined) input.own?.(awake.pid);
    }
    await stageDesktop({
      directory: stagedPath,
      productName: 'Porcelain Dev',
      web: true,
    });
    const repositoryPath = await sampleRepository(workspace);
    const port = await freePort();
    const options = launchOptions({
      app: stagedPath,
      profile: profilePath,
      projectHome: repositoryPath,
      switches: [`--remote-debugging-port=${port}`],
    });
    const launchOptionsFile = join(input.folder, 'electron-launch.json');
    await writeFile(
      launchOptionsFile,
      `${JSON.stringify(options, null, 2)}\n`,
      { mode: 0o600 },
    );
    electron = await _electron.launch(options);
    child = electron.process();
    if (child.pid === undefined)
      throw new Error('Electron returned no app PID');
    input.own?.(child.pid);
    child.stderr?.on('data', (chunk: Buffer) => {
      appendFileSync(join(input.evidenceDirectory, 'electron.log'), chunk);
    });
    const page = await electron.firstWindow();
    await page.waitForURL(
      (url) => url.protocol === 'porcelain:' && url.pathname !== '/pair',
    );
    const identity = await electron.evaluate(({ app }) => ({
      productName: app.getName(),
      packaged: app.isPackaged,
      profilePath: app.getPath('userData'),
    }));
    if (
      identity.packaged ||
      identity.productName !== 'Porcelain Dev' ||
      identity.profilePath !== profilePath
    )
      throw new Error(
        'Refused an app that is not the instance-owned, unpackaged Porcelain Dev',
      );
    const server = await ownerStatus(join(profilePath, 'server'));
    input.own?.(server.pid);
    const health = await fetch(`${server.address}/api/health`);
    if (
      health.status !== 200 ||
      !health.headers.get('content-type')?.includes('application/json')
    )
      throw new Error('Desktop health did not answer JSON 200');
    const { environmentId } = Schema.decodeUnknownSync(
      readHealthResponseSchema,
    )(await health.json());
    const cli = join(
      repositoryRoot,
      '.agents/skills/desktop-verify/scripts/cli',
    );
    const command = (name: string) =>
      shellCommand([cli, name, '--instance', input.id]);
    const serverCommand = [
      process.execPath,
      join(repositoryRoot, 'scripts/server.ts'),
      '--data-directory',
      server.dataDirectory,
    ];
    const card = {
      instanceId: input.id,
      surface: 'desktop' as const,
      build: {
        ...buildIdentity(repositoryRoot),
        sourceFingerprint:
          input.sourceFingerprint ??
          buildFingerprint(repositoryRoot, desktopInputs, [
            dirname(fileURLToPath(import.meta.url)),
            join(repositoryRoot, '.agents/skills/verify-core'),
          ]),
        startedAt: new Date().toISOString(),
      },
      fixtures: {
        environmentId,
        projectId: '',
        worktreeId: '',
        repositoryPath,
        projectHome: repositoryPath,
      },
      serverUrl: server.address,
      webUrl: server.address,
      webSocketUrl: new URL('/api/live', server.address).href.replace(
        /^http/,
        'ws',
      ),
      requiredOrigin: { http: server.address, webSocket: server.address },
      ownerSocketPath: join(server.dataDirectory, 'server.sock'),
      serverDataDirectory: server.dataDirectory,
      credentialFiles: {
        remoteEncrypted: join(profilePath, 'credentials.enc'),
      },
      pairing: {
        command: shellCommand([
          ...serverCommand,
          'pair',
          'Desktop verification',
          '--address',
          server.address,
        ]),
      },
      mcp: {
        command: `cd ${shellCommand([repositoryPath])} && ${shellCommand([...serverCommand, 'mcp'])}`,
      },
      evidenceDirectory: input.evidenceDirectory,
      statusCommand: command('status'),
      logsCommand: command('logs'),
      stopCommand: command('stop'),
      app: {
        productName: identity.productName,
        osName: process.platform,
        executablePath: electronExecutable(),
        bundlePath:
          process.platform === 'darwin'
            ? join(electronExecutable(), '../../..')
            : null,
        pid: child.pid,
        serverPid: server.pid,
        profilePath,
        stagedPath,
      },
      rendererUrl: page.url(),
      rendererCdpEndpoint: `http://127.0.0.1:${port}`,
      electron: {
        launchOptionsFile,
        lifecycleEntryPoint:
          new URL('./start.ts', import.meta.url).pathname + '#startDesktop',
      },
      capabilities: {
        macOSOnly: [
          'Keychain credentials',
          'macOS menus and folder sheets',
          'macOS window transitions',
        ],
      },
    };
    await writeFile(
      join(input.folder, 'connection.json'),
      `${JSON.stringify(card, null, 2)}\n`,
      { mode: 0o600 },
    );
    return { electron, card, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
