import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IsolatedServer } from '../../../../apps/server/spec/kit/isolated-server.ts';
import { buildIsolatedServer } from '../../../../apps/server/spec/kit/sandbox.ts';
import { refuseMissing, sandboxProblems } from './core/cli.ts';
import { repositoryRoot } from './core/registry.ts';
import { registry } from './instance.ts';

const READY_LIMIT_MS = 60 * 1000;

export async function start(): Promise<string> {
  const started = performance.now();
  refuseMissing(sandboxProblems());
  const instance = await registry.launch({}, READY_LIMIT_MS);
  const durationMs = Math.round(performance.now() - started);
  const written = await registry.evidence(instance).json('start', {
    command: ['start'],
    durationMs,
    instance: {
      id: instance.id,
      address: instance.detail.address,
      fingerprint: instance.fingerprint,
      pid: instance.pid,
      repository: instance.detail.repository,
    },
  });
  process.stderr.write(`started in ${durationMs} ms; evidence: ${written}\n`);
  return `instance ${instance.id}\nurl ${instance.detail.address}\nevidence ${instance.evidence}\n`;
}

export function serve(folder: string): Promise<void> {
  return registry.serve(folder, async (life) => {
    const build = join(folder, 'build');
    const logFile = join(folder, 'server.log');
    await buildIsolatedServer(build);
    const server = await IsolatedServer.start(
      repositoryRoot,
      build,
      undefined,
      (text) => appendFileSync(logFile, text),
    );
    life.secret(server.credential, server.desktopCredential);
    life.onStop(async (reason) => {
      appendFileSync(logFile, `\n[cli] stopping: ${reason}\n`);
      await life.evidence().json('server-stop', {
        command: ['serve'],
        reason,
        serverOutput: readFileSync(logFile, 'utf8'),
      });
      await server.stop();
    });
    server.exited.then(
      () => life.stop('the server exited'),
      () => life.stop('the server failed'),
    );
    const ids = await server.sampleIds();
    return {
      address: server.address,
      manifestPath: server.manifestPath,
      projectId: ids.projectId,
      worktreeId: ids.worktreeId,
      repository: server.repository,
      projectHome: server.projectHome,
      logFile,
    };
  });
}
