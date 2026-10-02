import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inject, test as base, type TestError } from 'vitest';
import { IsolatedServer, Recorder } from './isolated-server.ts';
import { list, record, type Session } from './session.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    serverBuild: string;
    serverSample: 'perf' | 'none';
    serverRoutes: string;
  }
}

export type RouteLog = { registered: Set<string>; requested: Set<string> };

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

async function sampleIds(server: IsolatedServer) {
  const inventory = await server.read(new Recorder(), {
    method: 'GET',
    path: '/api/inventory',
  });
  const [project, ...others] = list(record(inventory.body).projects).map(
    record,
  );
  const worktree = list(project?.worktrees)
    .map(record)
    .find((entry) => entry.main === true);
  if (
    others.length > 0 ||
    typeof project?.id !== 'string' ||
    typeof worktree?.id !== 'string'
  )
    throw new Error('The sample inventory is not one registered project');
  return { projectId: project.id, worktreeId: worktree.id };
}

function scrubbed(error: TestError, recorder: Recorder) {
  for (const [key, value] of Object.entries(error))
    if (typeof value === 'string') error[key] = recorder.scrub(value);
  if (error.cause) scrubbed(error.cause, recorder);
}

export const test = base
  .extend('routeFolder', { scope: 'worker' }, () => inject('serverRoutes'))
  .extend(
    'routeLog',
    { scope: 'file', auto: true },
    async ({ routeFolder }, { onCleanup }): Promise<RouteLog> => {
      const log: RouteLog = { registered: new Set(), requested: new Set() };
      onCleanup(() =>
        writeFile(
          join(routeFolder, `${randomUUID()}.json`),
          JSON.stringify({
            registered: [...log.registered],
            requested: [...log.requested],
          }),
        ),
      );
      return log;
    },
  )
  .extend('server', { scope: 'file' }, async ({ routeLog }, { onCleanup }) => {
    const sample = inject('serverSample');
    const server = await IsolatedServer.start(
      repositoryRoot,
      inject('serverBuild'),
      sample === 'perf' ? sample : undefined,
    );
    onCleanup(async () => {
      for (const route of server.routes) routeLog.registered.add(route);
      for (const route of await server.requestedRoutes())
        routeLog.requested.add(route);
      const failure = await server.stop();
      if (failure) throw new Error(failure);
    });
    return server;
  })
  .extend('ids', { scope: 'file' }, ({ server }) => sampleIds(server))
  .extend('recorder', async ({ server, onTestFailed }, { onCleanup }) => {
    const recorder = new Recorder();
    recorder.secret(server.credential);
    recorder.secret(server.desktopCredential);
    recorder.phase = 'follow-up';
    onTestFailed(({ task }) => {
      for (const error of task.result?.errors ?? []) scrubbed(error, recorder);
    });
    onCleanup(() => {
      for (const cleanup of recorder.cleanups) cleanup();
    });
    return recorder;
  })
  .extend('session', ({ server, ids, recorder }): Session =>
    server.session(recorder, ids),
  );
