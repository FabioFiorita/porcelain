import { lstat } from 'node:fs';
import { GitFilesystemError } from '../../shared/errors/git-filesystem-error.ts';
import { Effect, FileSystem, Path } from 'effect';
import { isMissing } from '../../shared/errors/is-missing.ts';
import { readGitDirectory } from '../../shared/commands/gitdir.ts';
import { isOid } from '../../shared/parsers/oid.ts';

export const readInProgress = Effect.fn('Git.readInProgress')(function* (
  checkout: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const pointer = yield* readGitDirectory(checkout);
  if (pointer === undefined) return { inProgress: null, mergeHeadOid: null };
  const gitDirectory = yield* fs.realPath(pointer);
  const exists = (file: string) =>
    Effect.callback<boolean, GitFilesystemError>((resume) => {
      lstat(file, (cause) =>
        resume(
          cause
            ? Effect.fail(new GitFilesystemError({ cause }))
            : Effect.succeed(true),
        ),
      );
    }).pipe(
      Effect.catchIf(
        (error) => isMissing(error.cause),
        () => Effect.succeed(false),
      ),
    );
  if (
    (yield* exists(path.join(gitDirectory, 'rebase-merge'))) ||
    (yield* exists(path.join(gitDirectory, 'rebase-apply')))
  )
    return { inProgress: 'rebase' as const, mergeHeadOid: null };
  const mergeHead = yield* fs
    .readFileString(path.join(gitDirectory, 'MERGE_HEAD'))
    .pipe(Effect.catchIf(isMissing, () => Effect.succeed(undefined)));
  if (mergeHead === undefined) return { inProgress: null, mergeHeadOid: null };
  const oids = mergeHead.trimEnd().split('\n');
  const [oid] = oids;
  return {
    inProgress: 'merge' as const,
    mergeHeadOid:
      oids.length === 1 && oid !== undefined && isOid(oid) ? oid : null,
  };
});
