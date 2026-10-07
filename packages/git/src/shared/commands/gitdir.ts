import { Effect, FileSystem, Path } from 'effect';
import { isMissing } from '../errors/is-missing.ts';

export function parseGitdirFile(text: string): string | undefined {
  const pointer = text.trim();
  if (!pointer.startsWith('gitdir:')) return undefined;
  const target = pointer.slice('gitdir:'.length).trim();
  return target === '' || /[\0\r\n]/u.test(target) ? undefined : target;
}

export const readGitDirectory = Effect.fn('Git.readGitDirectory')(function* (
  checkout: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dotGit = path.join(checkout, '.git');
  if ((yield* fs.stat(dotGit)).type === 'Directory') return dotGit;
  const target = parseGitdirFile(yield* fs.readFileString(dotGit));
  return target === undefined ? undefined : path.resolve(checkout, target);
});

export const readCommonDirectory = Effect.fn('Git.readCommonDirectory')(
  function* (gitDirectory: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const target = yield* fs
      .readFileString(path.join(gitDirectory, 'commondir'))
      .pipe(Effect.catchIf(isMissing, () => Effect.succeed(undefined)));
    return target === undefined
      ? gitDirectory
      : path.resolve(gitDirectory, target.trim());
  },
);

export const readGitdirPointer = Effect.fn('Git.readGitdirPointer')(function* (
  administrativeDirectory: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const pointer = yield* fs
    .readFileString(path.join(administrativeDirectory, 'gitdir'))
    .pipe(
      Effect.map((text) => text.trim()),
      Effect.orElseSucceed(() => ''),
    );
  if (pointer === '') return null;
  return path.resolve(administrativeDirectory, pointer, '..');
});

export const readWorktreeRegistry = Effect.fn('Git.readWorktreeRegistry')(
  function* (commonDirectory: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = path.join(commonDirectory, 'worktrees');
    const names = yield* fs
      .readDirectory(root)
      .pipe(
        Effect.catchIf(isMissing, () => Effect.succeed<readonly string[]>([])),
      );
    const registry = new Map<string, string>();
    for (const name of names) {
      const administrativeDirectory = path.join(root, name);
      const checkout = yield* readGitdirPointer(administrativeDirectory);
      if (!checkout) continue;
      registry.set(yield* realpathOrSelf(checkout), administrativeDirectory);
    }
    return registry;
  },
);

export const realpathOrSelf = Effect.fn('Git.realpathOrSelf')(function* (
  path: string,
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.realPath(path).pipe(Effect.orElseSucceed(() => path));
});

export const contained = Effect.fn('Git.contained')(function* (
  administrativeDirectory: string,
  commonDirectory: string,
) {
  if (administrativeDirectory === commonDirectory) return true;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* Effect.gen(function* () {
    const root = yield* fs.realPath(path.join(commonDirectory, 'worktrees'));
    const real = yield* fs.realPath(administrativeDirectory);
    return real.startsWith(`${root}${path.sep}`);
  }).pipe(Effect.orElseSucceed(() => false));
});

export const corroborates = Effect.fn('Git.corroborates')(function* (
  path: string,
  administrativeDirectory: string,
) {
  return yield* Effect.gen(function* () {
    const gitDirectory = yield* readGitDirectory(path);
    return (
      gitDirectory !== undefined &&
      (yield* realpathOrSelf(gitDirectory)) ===
        (yield* realpathOrSelf(administrativeDirectory))
    );
  }).pipe(Effect.orElseSucceed(() => false));
});
