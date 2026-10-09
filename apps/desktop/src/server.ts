import { DesktopError } from './errors/desktop-error.ts';
import { Cause, Deferred, Effect, Queue, Schema, Stream } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { join } from 'node:path';
import {
  openAppManagedUpdateRunner,
  readServerSettings,
  startServer,
} from '@porcelain/server/desktop';
import { hostMessage } from './protocol.ts';
import { finishServerOutput } from './adapters/server-output.ts';

const application = Effect.gen(function* () {
  const parent = process.parentPort;
  if (parent === null)
    return yield* Effect.fail(
      new DesktopError({ message: 'The desktop server requires its app host' }),
    );
  const messages = yield* Queue.make<unknown>();
  const receive = (event: { data: unknown }) => {
    Queue.offerUnsafe(messages, event.data);
  };
  yield* Effect.acquireRelease(
    Effect.sync(() => parent.on('message', receive)),
    () => Effect.sync(() => parent.removeListener('message', receive)),
  );
  const startup = yield* Queue.take(messages).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(hostMessage)),
  );
  if (startup.kind !== 'start')
    return yield* Effect.fail(
      new DesktopError({
        message: 'The desktop server requires private startup configuration',
      }),
    );
  const { profile, projectHome, packageRoot, version, session, outputEnd } =
    startup;
  const stop = yield* Deferred.make<void>();
  const exit = yield* Deferred.make<void>();
  yield* Stream.fromQueue(messages).pipe(
    Stream.runForEach((message) =>
      Schema.decodeUnknownEffect(hostMessage)(message).pipe(
        Effect.flatMap((command) =>
          command.kind === 'stop'
            ? Deferred.succeed(stop, undefined).pipe(Effect.asVoid)
            : command.kind === 'exit' && Deferred.isDoneUnsafe(stop)
              ? Deferred.succeed(exit, undefined).pipe(Effect.asVoid)
              : Effect.fail(
                  new DesktopError({
                    message: 'The desktop server is already started',
                  }),
                ),
        ),
        Effect.catch((error) =>
          Effect.sync(() =>
            parent.postMessage({ kind: 'failed', message: error.message }),
          ),
        ),
      ),
    ),
    Effect.forkScoped,
  );
  const terminate = () => {
    Deferred.doneUnsafe(stop, Effect.void);
  };
  yield* Effect.acquireRelease(
    Effect.sync(() => process.on('SIGTERM', terminate)),
    () => Effect.sync(() => process.removeListener('SIGTERM', terminate)),
  );
  const settings = readServerSettings({
    dataDirectory: join(profile, 'server'),
    projectHome,
    host: '127.0.0.1',
    port: 0,
    webRoot: join(packageRoot, 'web'),
  });
  yield* Effect.gen(function* () {
    const server = yield* startServer(settings, {
      desktopSession: session,
      version,
      serviceUpdateRunner: yield* openAppManagedUpdateRunner(),
    });
    yield* Effect.addFinalizer(() => server.close());
    parent.postMessage({ kind: 'ready', address: server.address });
    yield* Deferred.await(stop);
  }).pipe(Effect.scoped);
  yield* finishServerOutput(outputEnd);
  yield* Deferred.await(exit);
  process.exitCode = 0;
}).pipe(
  Effect.scoped,
  Effect.provide(NodeServices.layer),
  Effect.catchCause((cause) =>
    Effect.sync(() => {
      const error = Cause.squash(cause);
      process.parentPort?.postMessage({
        kind: 'failed',
        message:
          error instanceof Error
            ? error.message
            : 'Local server startup failed',
      });
      process.exitCode = 1;
    }),
  ),
);

Effect.runFork(
  application.pipe(
    Effect.ensuring(Effect.sync(() => process.exit(process.exitCode ?? 0))),
  ),
);
