import { Effect, type FileSystem, type Path, type Scope } from 'effect';
import type { ServerSettings } from '../config/server-settings.ts';
import type { Runtime } from '../ports/runtime.ts';
import type { ServerHost } from '../ports/server-host.ts';

export type StartServer = (
  settings: ServerSettings,
  signal: AbortSignal,
  host: ServerHost,
) => Effect.Effect<
  Runtime,
  never,
  Scope.Scope | FileSystem.FileSystem | Path.Path
>;

type LauncherDependencies = {
  startServer: StartServer;
  host: ServerHost;
  output: (message: string) => void;
};

export const runLocalServer = Effect.fn('runLocalServer')(function* (
  settings: ServerSettings,
  signal: AbortSignal,
  dependencies: LauncherDependencies,
) {
  yield* Effect.sync(() => signal.throwIfAborted());
  const server = yield* dependencies.startServer(
    settings,
    signal,
    dependencies.host,
  );
  yield* Effect.gen(function* () {
    if (signal.aborted) return;
    yield* Effect.sync(() => {
      dependencies.output(`Porcelain listening at ${server.address}`);
      dependencies.output(`Owner socket: ${server.socketPath}`);
      dependencies.output(
        'Pair a device with: porcelain pair <name> --address <origin>',
      );
    });
    return yield* Effect.never;
  }).pipe(Effect.ensuring(server.close()));
});
