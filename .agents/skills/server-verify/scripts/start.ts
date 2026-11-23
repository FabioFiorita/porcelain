import { Schema } from 'effect';
import { readServerHealth } from '../../verify-core/health.ts';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IsolatedServer } from '@porcelain/server/kit/isolated-server';
import { buildIsolatedServer } from '@porcelain/server/kit/sandbox';
import {
  memoryProblem,
  refuseMissing,
  sandboxProblems,
} from '../../verify-core/cli.ts';
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
  refuseMissing([...sandboxProblems(), memoryProblem()]);
  const instance = await registry.launch({}, READY_LIMIT_MS);
  await registry.evidence(instance).json('start', {
    command: ['start'],
    instance: {
      id: instance.id,
      address: instance.detail.address,
      fingerprint: instance.fingerprint,
      pid: instance.pid,
      repository: instance.detail.repository,
    },
  });
  const path = instance.connectionPath;
  if (path === undefined)
    throw new Error('The server published no connection metadata');
  return connectionCard(
    Schema.decodeUnknownSync(connectionSchema)(
      JSON.parse(readFileSync(path, 'utf8')),
    ),
    path,
    instance.readyMs,
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
    const { environmentId } = await readServerHealth(server.address);
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
