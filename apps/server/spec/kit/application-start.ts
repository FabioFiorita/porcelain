import { existsSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { NodeServices } from '@effect/platform-node';
import {
  Cause,
  Clock,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Scope,
} from 'effect';
import { HttpRouter, HttpServerResponse } from 'effect/http';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { readServerSettings } from '../../src/config/server-settings.ts';
import { createHttpListener } from '../../src/http/server-factory.ts';
import {
  ServerComponents,
  openServerResources,
} from '../../src/runtime/server-resources.ts';
import { startApplication } from '../../src/runtime/start-application.ts';

export async function applicationStartFixture(
  ownerFails = false,
  pauseAtJob = false,
) {
  const root = await mkdtemp(
    join(process.platform === 'darwin' ? '/tmp' : tmpdir(), 'porcelain-start-'),
  );
  const settings = readServerSettings({
    dataDirectory: join(root, 'data'),
    projectHome: root,
    port: 0,
  });
  const events: string[] = [];
  const started = Deferred.makeUnsafe<void>();
  const release = Deferred.makeUnsafe<void>();
  const startupEntered = Deferred.makeUnsafe<void>();
  const options = {
    logger: { failure: () => undefined },
    websocketMaxBytes: settings.limits.liveUpdates.messageBytes,
    closeGrace: settings.limits.listeners.closeGrace,
  };
  const network = createHttpListener({
    ...options,
    principal: undefined,
    application: HttpRouter.add('GET', '/', HttpServerResponse.text('network')),
  });
  const owner = createHttpListener({
    ...options,
    principal: { kind: 'owner' },
    application: Layer.mergeAll(
      HttpRouter.add('GET', '/', HttpServerResponse.text('owner')),
      ownerFails
        ? Layer.effectDiscard(Effect.die(new Error('Owner routes failed')))
        : Layer.empty,
    ),
  });
  const scope = Effect.runSync(Scope.make());
  const start = startApplication(settings, {
    clock: Effect.runSync(Clock.Clock),
    ownerProbe: { probe: () => Effect.succeed({ kind: 'absent' as const }) },
    openServer: () =>
      openServerResources(
        Layer.effect(
          ServerComponents,
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                events.push('persistence');
              }),
            );
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                events.push('components');
              }),
            );
            return {
              network,
              owner,
              jobs: [
                {
                  start: () =>
                    Effect.gen(function* () {
                      events.push('job-started');
                      if (pauseAtJob) {
                        yield* Deferred.succeed(startupEntered, undefined);
                        return yield* Effect.never;
                      }
                    }),
                  stop: () =>
                    Effect.gen(function* () {
                      events.push('job-stopping');
                      yield* Deferred.succeed(started, undefined);
                      yield* Deferred.await(release);
                      events.push('job-stopped');
                    }),
                },
              ],
              close: () => Effect.void,
            };
          }),
        ),
      ),
  }).pipe(Scope.provide(scope), Effect.provide(NodeServices.layer));
  return {
    start,
    root,
    network,
    owner,
    events,
    started,
    release,
    startupEntered,
    cleanup: async () => {
      Deferred.doneUnsafe(release, Effect.void);
      await Effect.runPromiseExit(Scope.close(scope, Exit.void));
      await rm(root, { recursive: true, force: true });
    },
  };
}

export async function readOwnerSocket(socketPath: string) {
  return await new Promise<string>((resolve, reject) => {
    const sending = request(
      { socketPath: socketPath, path: '/' },
      (response) => {
        let body = '';
        response.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        response.once('end', () => resolve(body));
      },
    );
    sending.once('error', reject);
    sending.end();
  });
}

export async function closeStartedApplication() {
  const running = await applicationStartFixture();
  try {
    const application = await Effect.runPromise(running.start);
    const networkBody = await (await fetch(application.address)).text();
    const ownerBody = await readOwnerSocket(application.socketPath);
    const ownerMode = (await stat(application.socketPath)).mode & 0o777;
    const first = Effect.runFork(application.close());
    await Effect.runPromise(Deferred.await(running.started));
    const second = Effect.runFork(application.close());
    const duringDrain = {
      firstPending: first.pollUnsafe() === undefined,
      secondPending: second.pollUnsafe() === undefined,
      networkListening: running.network.server.listening,
      ownerListening: running.owner.server.listening,
      events: [...running.events],
    };
    Deferred.doneUnsafe(running.release, Effect.void);
    await Effect.runPromise(
      Effect.all([Fiber.join(first), Fiber.join(second)]),
    );
    await Effect.runPromise(application.close());
    return {
      networkBody,
      ownerBody,
      ownerMode,
      duringDrain,
      events: [...running.events],
      locked: existsSync(join(running.root, 'data', 'server.lock')),
    };
  } finally {
    await running.cleanup();
  }
}

export async function failOwnerStartup() {
  const running = await applicationStartFixture(true);
  Deferred.doneUnsafe(running.release, Effect.void);
  try {
    const exit = await Effect.runPromiseExit(running.start);
    const error = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;
    return {
      failure: error instanceof Error ? error.message : undefined,
      networkListening: running.network.server.listening,
      ownerListening: running.owner.server.listening,
      events: [...running.events],
      locked: existsSync(join(running.root, 'data', 'server.lock')),
    };
  } finally {
    await running.cleanup();
  }
}

export async function interruptApplicationStartup() {
  const running = await applicationStartFixture(false, true);
  Deferred.doneUnsafe(running.release, Effect.void);
  try {
    const fiber = Effect.runFork(running.start);
    await Effect.runPromise(Deferred.await(running.startupEntered));
    await Effect.runPromise(Fiber.interrupt(fiber));
    const exit = await Effect.runPromise(Fiber.await(fiber));
    return {
      interrupted: Exit.hasInterrupts(exit),
      networkListening: running.network.server.listening,
      ownerListening: running.owner.server.listening,
      events: [...running.events],
      locked: existsSync(join(running.root, 'data', 'server.lock')),
    };
  } finally {
    await running.cleanup();
  }
}
