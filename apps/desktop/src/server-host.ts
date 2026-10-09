import { DesktopError } from './errors/desktop-error.ts';
import { Deferred, Effect, Result, Schema, Scope } from 'effect';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { app, utilityProcess } from 'electron';
import type { desktopSettings } from './settings.ts';
import { serverMessage } from './protocol.ts';
import { openServerLog } from './adapters/server-log.ts';
import { drainServerOutput } from './adapters/server-output.ts';

export const startLocalServer = Effect.fn('startLocalServer')(function* (
  settings: ReturnType<typeof desktopSettings>,
) {
  const credential = randomBytes(
    settings.limits.credentials.secretBytes,
  ).toString('base64url');
  const log = yield* openServerLog(
    settings.logs,
    settings.limits.desktop.serverLogBytes,
  );
  const exited = yield* Deferred.make<number>();
  const ready = yield* Deferred.make<string, DesktopError>();
  const onExit = (code: number) => {
    process.stderr.write(`Porcelain server: exited ${code}\n`);
    Deferred.doneUnsafe(exited, Effect.succeed(code));
    Deferred.doneUnsafe(
      ready,
      Effect.fail(
        new DesktopError({ message: `The local server exited (${code})` }),
      ),
    );
  };
  const outputScope = yield* Scope.fork(yield* Scope.Scope, 'sequential');
  const child = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const child = utilityProcess.fork(settings.serverEntry, [], {
        serviceName: 'Porcelain Server',
        stdio: 'pipe',
        cwd: settings.projectHome,
      });
      child.once('exit', onExit);
      return child;
    }),
    (child) =>
      Effect.gen(function* () {
        if (!(yield* Deferred.isDone(exited))) {
          child.postMessage({ kind: 'stop' });
          yield* Deferred.await(exited).pipe(
            Effect.timeoutOption(settings.limits.desktop.shutdownMs),
            Effect.flatMap((result) =>
              result._tag === 'Some'
                ? Effect.void
                : Effect.gen(function* () {
                    process.stderr.write(
                      'Porcelain: server shutdown deadline reached\n',
                    );
                    child.kill();
                    yield* Deferred.await(exited);
                  }),
            ),
          );
        }
        yield* log.flush();
      }),
  );
  const outputEnd = randomUUID();
  const onMessage = (message: unknown) => {
    const parsed = Schema.decodeUnknownResult(serverMessage)(message);
    if (!Result.isSuccess(parsed)) return;
    const answer = parsed.success;
    if (answer.kind === 'ready')
      Deferred.doneUnsafe(ready, Effect.succeed(answer.address));
    else
      Deferred.doneUnsafe(
        ready,
        Effect.fail(new DesktopError({ message: answer.message })),
      );
  };
  const onSpawn = () =>
    child.postMessage({
      kind: 'start',
      outputEnd,
      profile: settings.profile,
      projectHome: settings.projectHome,
      packageRoot: settings.packageRoot,
      version: app.getVersion(),
      session: {
        deviceId: randomUUID(),
        secretHash: createHash('sha256').update(credential).digest('hex'),
      },
    });
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      child.on('message', onMessage);
      child.once('spawn', onSpawn);
    }),
    () =>
      Effect.sync(() => {
        child.removeListener('message', onMessage);
        child.removeListener('spawn', onSpawn);
      }),
  );
  yield* Effect.all(
    [
      drainServerOutput(child.stdout, outputEnd, (chunk) =>
        Effect.sync(() => {
          process.stdout.write(chunk);
        }).pipe(Effect.andThen(log.append(chunk))),
      ),
      drainServerOutput(child.stderr, outputEnd, (chunk) =>
        Effect.sync(() => {
          process.stderr.write(chunk);
        }).pipe(Effect.andThen(log.append(chunk))),
      ),
    ],
    { concurrency: 'unbounded' },
  ).pipe(
    Effect.scoped,
    Effect.andThen(log.flush()),
    Effect.andThen(
      Effect.sync(() => {
        process.stderr.write('Porcelain: server output persisted\n');
        child.postMessage({ kind: 'exit' });
      }),
    ),
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(
          `Porcelain: server output not drained: ${error instanceof Error ? error.message : 'unknown failure'}\n`,
        );
      }),
    ),
    Effect.forkIn(outputScope),
  );
  const address = yield* Deferred.await(ready).pipe(
    Effect.timeoutOrElse({
      duration: settings.limits.desktop.startupMs,
      orElse: () =>
        Effect.fail(
          new DesktopError({
            message: 'The local server did not start in time',
          }),
        ),
    }),
  );
  const watch = Effect.fn('LocalServer.watch')((onExit: () => void) =>
    Deferred.await(exited).pipe(
      Effect.andThen(Effect.sync(onExit)),
      Effect.forkIn(outputScope),
      Effect.asVoid,
    ),
  );
  return { address, credential, watch };
});
