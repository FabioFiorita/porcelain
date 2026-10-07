import { Effect, FileSystem, Path } from 'effect';
import { parseHeadFile } from '../parsers/refs.ts';

export const readHeadFile = Effect.fn('Git.readHeadFile')(function* (
  gitDirectory: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return parseHeadFile(
    yield* fs.readFileString(path.join(gitDirectory, 'HEAD')),
  );
});
