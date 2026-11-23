import { Effect, FileSystem, Path, type Scope } from 'effect';
import type { PlatformError } from 'effect/PlatformError';
import { ChildProcessSpawner } from 'effect/process';
import { installedModels } from '../../shared/commands/installed-models.ts';
import { findExecutable } from '../../shared/commands/find-executable.ts';
import { ProviderProcessFailedError } from '../errors/provider-process-failed-error.ts';
import { runProvider } from './run-provider.ts';

export const captureProviderRuntime = Effect.fn(
  'Agents.captureProviderRuntime',
)(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const executable = (name: string) =>
    findExecutable(name).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
    );
  const models = (...input: Parameters<typeof installedModels>) =>
    installedModels(...input).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    );
  const run = (input: Parameters<typeof runProvider>[0]) =>
    runProvider(input).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    );
  return { fs, path, executable, models, run };
});

export function withProviderScope<A, E extends { readonly _tag: string }>(
  effect: Effect.Effect<A, E | PlatformError, Scope.Scope>,
) {
  return Effect.scoped(effect).pipe(
    Effect.catchTag('PlatformError', (cause) =>
      Effect.fail(new ProviderProcessFailedError({ cause })),
    ),
  );
}
