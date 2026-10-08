import { Schema } from 'effect';
import { readHealthResponseSchema } from '@porcelain/contracts/access';
import { spawn } from 'node:child_process';
import {
  appendFileSync,
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  IsolatedServer,
  Recorder,
} from '../../../../apps/server/spec/kit/isolated-server.ts';
import { prepareRemote } from '../../../../apps/server/spec/kit/remote-computer.ts';
import { buildIsolatedServer } from '../../../../apps/server/spec/kit/sandbox.ts';
import {
  freePort,
  refuseMissing,
  sandboxProblems,
} from '../../verify-core/cli.ts';
import {
  connectionCard,
  connectionSchema,
} from '../../verify-core/connection.ts';
import {
  repositoryRoot as root,
  type Life,
} from '../../verify-core/registry.ts';
import { registry } from './instance.ts';
import { agentActs } from '../../../../apps/server/spec/kit/agent.ts';

export const vite = join(root, 'apps/web/node_modules/.bin/vite');
const readyTimeoutMs = 60 * 1000;
const remotePollMs = 200;
export const remoteRequest = 'remote-request';
export const remoteFailed = 'remote-failed';
const startOptions = Schema.Struct({
  desktop: Schema.Boolean,
  codingTool: Schema.Boolean,
  reviewSample: Schema.Boolean,
});

async function reachable(url: string, deadline: number): Promise<void> {
  for (;;) {
    const answered = await fetch(url).then(
      (response) => response.ok,
      () => false,
    );
    if (answered) return;
    if (Date.now() > deadline)
      throw new Error(`Vite did not answer ${url} in time`);
    await sleep(200);
  }
}
function serveRemote(
  folder: string,
  id: string,
  build: string,
  life: Pick<Life, 'secret' | 'onStop'>,
) {
  let started = false;
  const timer = setInterval(() => {
    const request = join(folder, remoteRequest);
    if (started || !existsSync(request)) return;
    started = true;
    clearInterval(timer);
    const startRemote = async () => {
      await unlink(request);
      const remote = await IsolatedServer.start(root, build);
      life.onStop(async () => {
        await remote.stop();
      });
      life.secret(remote.credential, remote.desktopCredential);
      const recorder = new Recorder();
      recorder.phase = 'follow-up';
      await prepareRemote(remote, recorder);
      const current = registry
        .list()
        .find((entry) => entry.instance.id === id)?.instance;
      if (current === undefined) return;
      registry.update(current, (instance) => ({
        ...instance,
        secrets: [
          ...instance.secrets,
          remote.credential,
          remote.desktopCredential,
        ],
        detail: {
          ...instance.detail,
          remote: {
            manifest: remote.manifestPath,
            address: remote.address,
            repository: remote.repository,
          },
        },
      }));
    };
    startRemote().catch((error: unknown) => {
      writeFileSync(
        join(folder, remoteFailed),
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
    });
  }, remotePollMs);
  life.onStop(() => {
    clearInterval(timer);
  });
}
export function serve(folder: string): Promise<void> {
  return registry.serve(folder, async (life) => {
    const { desktop, codingTool, reviewSample } = Schema.decodeUnknownSync(
      startOptions,
    )(life.options);
    const evidence = registry.evidenceFolder(life.id);
    const build = join(folder, 'build');
    await buildIsolatedServer(build);
    const server = await IsolatedServer.start(root, build, undefined, (text) =>
      appendFileSync(join(evidence, 'server.log'), text),
    );
    server.exited.then(
      () => life.stop('the server exited'),
      () => life.stop('the server failed'),
    );
    life.onStop(async () => {
      await server.stop();
    });
    life.secret(server.credential, server.desktopCredential);
    const recorder = new Recorder();
    recorder.phase = 'follow-up';
    const owner = server.session(recorder, { projectId: '', worktreeId: '' });
    if (codingTool) await owner.installCodingTool();
    if (reviewSample) await agentActs(owner, { kind: 'publish-architecture' });
    const port = await freePort();
    const origin = `http://127.0.0.1:${port}`;
    const log = openSync(join(evidence, 'vite.log'), 'a', 0o600);
    const web = spawn(
      vite,
      [
        '--mode',
        desktop ? 'desktop' : 'test',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--strictPort',
      ],
      {
        cwd: join(root, 'apps/web'),
        env: { ...process.env, PORCELAIN_API_TARGET: server.address },
        stdio: ['ignore', log, log],
      },
    );
    closeSync(log);
    web.once('error', () => life.stop('Vite failed to start'));
    web.once('exit', () => life.stop('Vite exited'));
    life.onStop(() => {
      web.kill('SIGTERM');
    });
    await reachable(`${origin}/src/main.tsx`, Date.now() + readyTimeoutMs);
    serveRemote(folder, life.id, build, life);
    const health = await fetch(`${server.address}/api/health`);
    if (
      health.status !== 200 ||
      !health.headers.get('content-type')?.includes('application/json')
    )
      throw new Error(
        'The disposable health route did not answer JSON with status 200',
      );
    const { environmentId } = Schema.decodeUnknownSync(
      readHealthResponseSchema,
    )(await health.json());
    const ids = await server.sampleIds();
    const manifest = Schema.decodeUnknownSync(
      Schema.Struct({
        credentialFile: Schema.String,
        dataDirectory: Schema.String,
      }),
    )(JSON.parse(readFileSync(server.manifestPath, 'utf8')));
    await life.evidence().json('start', {
      web: origin,
      mode: desktop ? 'desktop' : 'web',
      codingTool: codingTool ? server.fixture.codingTool.command : null,
    });
    return {
      web: origin,
      address: server.address,
      environmentId,
      projectId: ids.projectId,
      worktreeId: ids.worktreeId,
      ownerSocketPath: server.socketPath,
      serverDataDirectory: manifest.dataDirectory,
      credentialFiles: { fixture: manifest.credentialFile },
      repository: server.repository,
      projectHome: server.projectHome,
      desktop,
      manifest: server.manifestPath,
    };
  });
}
export async function start(
  options: typeof startOptions.Encoded,
): Promise<string> {
  refuseMissing([
    ...sandboxProblems(),
    existsSync(vite)
      ? undefined
      : 'Vite is missing: run pnpm install --frozen-lockfile',
  ]);
  const started = performance.now();
  const instance = await registry.launch(options, readyTimeoutMs * 2);
  process.stderr.write(
    `started in ${Math.round(performance.now() - started)} ms\n`,
  );
  if (instance.connectionPath === undefined)
    throw new Error('The web launcher published no connection metadata');
  return connectionCard(
    Schema.decodeUnknownSync(connectionSchema)(
      JSON.parse(readFileSync(instance.connectionPath, 'utf8')),
    ),
    instance.connectionPath,
  );
}
