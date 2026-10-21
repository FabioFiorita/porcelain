import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inject, test as base, type TestError } from 'vitest';
import {
  IsolatedServer,
  Recorder,
  type ServerHandle,
} from './isolated-server.ts';
import type { Session } from './session.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    serverBuild: string;
    serverSample: 'perf' | 'none';
    serverRoutes: string;
  }
}

export type RouteLog = {
  registered: Set<string>;
  requested: Set<string>;
  registeredTools: Set<string>;
  invokedTools: Set<string>;
};

export async function recordHandlers(server: ServerHandle, log: RouteLog) {
  for (const route of server.routes) log.registered.add(route);
  for (const route of await server.requestedRoutes()) log.requested.add(route);
  for (const tool of server.tools) log.registeredTools.add(tool);
  for (const tool of await server.invokedTools()) log.invokedTools.add(tool);
}

export async function writeRouteLog(folder: string, log: RouteLog) {
  await writeFile(
    join(folder, `${randomUUID()}.json`),
    JSON.stringify({
      registered: [...log.registered],
      requested: [...log.requested],
      registeredTools: [...log.registeredTools],
      invokedTools: [...log.invokedTools],
    }),
  );
}

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

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
      const log: RouteLog = {
        registered: new Set(),
        requested: new Set(),
        registeredTools: new Set(),
        invokedTools: new Set(),
      };
      onCleanup(() => writeRouteLog(routeFolder, log));
      return log;
    },
  )
  .extend('server', { scope: 'file' }, async ({ routeLog }, { onCleanup }) => {
    const sample = inject('serverSample');
    return startServer(
      sample === 'perf' ? sample : undefined,
      routeLog,
      onCleanup,
    );
  })
  .extend('ids', { scope: 'file' }, ({ server }) => server.sampleIds())
  .extend('recorder', async ({ server, onTestFailed }, { onCleanup }) => {
    const recorder = new Recorder();
    recorder.secret(server.credential);
    recorder.secret(server.desktopCredential);
    recorder.phase = 'follow-up';
    let failed = false;
    onTestFailed(({ task }) => {
      failed = true;
      for (const error of task.result?.errors ?? []) scrubbed(error, recorder);
    });
    onCleanup(async () => {
      for (const cleanup of recorder.cleanups.toReversed()) await cleanup();
      const unread = recorder.unreadStatuses();
      if (!failed && unread.length > 0)
        throw new Error(
          `The test sent ${unread.join(', ')} and never read the status; assert every response it sends, or send a setup step through read(), which fails on an unexpected status.`,
        );
    });
    return recorder;
  })
  .extend('session', ({ server, ids, recorder }): Session =>
    server.session(recorder, ids),
  );

async function startServer(
  sample: Parameters<typeof IsolatedServer.start>[2],
  routeLog: RouteLog,
  onCleanup: (cleanup: () => Promise<void>) => void,
) {
  const server = await IsolatedServer.start(
    repositoryRoot,
    inject('serverBuild'),
    sample,
  );
  onCleanup(async () => {
    try {
      await recordHandlers(server, routeLog);
    } finally {
      await server.stop();
    }
  });
  return server;
}

export const gitInterruptionTest = test
  .extend('server', { scope: 'file' }, ({ routeLog }, { onCleanup }) =>
    startServer('git-interruption', routeLog, onCleanup),
  )
  .extend('ids', { scope: 'file' }, ({ server }) => server.sampleIds());
