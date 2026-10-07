import { Schema } from 'effect';
import { readHealthResponseSchema } from '@porcelain/contracts/access';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IsolatedServer } from '../../../../apps/server/spec/kit/isolated-server.ts';
import { buildIsolatedServer } from '../../../../apps/server/spec/kit/sandbox.ts';
import { refuseMissing, sandboxProblems } from '../../verify-core/cli.ts';
import { repositoryRoot } from '../../verify-core/registry.ts';
import {
  connectionCard,
  connectionSchema,
} from '../../verify-core/connection.ts';
import { registry } from './instance.ts';

const READY_LIMIT_MS = 60 * 1000;
const manifestSchema = Schema.Struct({
  credentialFile: Schema.String,
  dataDirectory: Schema.String,
});

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
  const path = instance.connectionPath;
  if (path === undefined)
    throw new Error('The server published no connection metadata');
  return connectionCard(
    Schema.decodeUnknownSync(connectionSchema)(
      JSON.parse(readFileSync(path, 'utf8')),
    ),
    path,
  );
}

export function serve(folder: string): Promise<void> {
  return registry.serve(folder, async (life) => {
    const build = join(folder, 'build');
    const logFile = join(life.evidence().folder, 'server.log');
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
      await server.stop();
      await life.evidence().json('server-stop', {
        command: ['serve'],
        reason,
        serverOutput: readFileSync(logFile, 'utf8'),
      });
    });
    server.exited.then(
      () => life.stop('the server exited'),
      () => life.stop('the server failed'),
    );
    const ids = await server.sampleIds();
    const manifest = Schema.decodeUnknownSync(manifestSchema)(
      JSON.parse(readFileSync(server.manifestPath, 'utf8')),
    );
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
    return {
      address: server.address,
      manifestPath: server.manifestPath,
      environmentId,
      ownerSocketPath: server.socketPath,
      serverDataDirectory: manifest.dataDirectory,
      credentialFiles: {
        fixture: manifest.credentialFile,
      },
      routes: server.routes,
      projectId: ids.projectId,
      worktreeId: ids.worktreeId,
      repository: server.repository,
      projectHome: server.projectHome,
      logFile,
    };
  });
}
