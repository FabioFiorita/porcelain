import { Context, Effect, FileSystem, Path } from 'effect';
import { ChildProcessSpawner } from 'effect/process';

type GitPlatform =
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner;

export const captureGitPlatform = Effect.fn('Git.capturePlatform')(
  function* () {
    const context = yield* Effect.context<GitPlatform>();
    const platform = Context.pick(
      FileSystem.FileSystem,
      Path.Path,
      ChildProcessSpawner.ChildProcessSpawner,
    )(context);
    return <A, E, R>(operation: Effect.Effect<A, E, R>) =>
      Effect.provideContext(operation, platform);
  },
);
