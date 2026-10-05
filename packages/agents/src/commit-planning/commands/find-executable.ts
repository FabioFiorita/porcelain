import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter } from 'node:path';
import { Config, Effect, FileSystem, Path } from 'effect';

export const findExecutable = Effect.fn('Provider.findExecutable')(function* (
  name: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const search = yield* Config.String('PATH').pipe(
    Config.withDefault(''),
    Effect.orElseSucceed(() => ''),
  );
  for (const directory of search.split(delimiter).filter(Boolean)) {
    const candidate = path.join(directory, name);
    const usable = yield* Effect.gen(function* () {
      yield* Effect.tryPromise(() => access(candidate, constants.X_OK));
      return (yield* fs.stat(candidate)).type === 'File';
    }).pipe(Effect.orElseSucceed(() => false));
    if (usable) return candidate;
  }
  return undefined;
});
