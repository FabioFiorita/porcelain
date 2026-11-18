import { DateTime, Effect, FileSystem, Option, Path } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { gitRead } from '../../shared/commands/run-git.ts';

const STAT_CONCURRENCY = 16;

export const readUncommittedChangedAt = Effect.fn(
  'Git.readUncommittedChangedAt',
)(function* (checkout: string, limits: GitLimits) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const output = yield* gitRead(
    checkout,
    [
      'status',
      '--porcelain=v1',
      '-z',
      '--no-renames',
      '--untracked-files=all',
      '--ignore-submodules=dirty',
    ],
    limits,
    { maxBytes: limits.inspection.statusBytes },
  );
  const paths = output
    .toString('utf8')
    .split('\0')
    .flatMap((record) => (record.length > 3 ? [record.slice(3)] : []))
    .slice(0, limits.inspection.maxChanges);
  const modified = (target: string) =>
    fs.stat(target).pipe(
      Effect.map((info) => Option.getOrUndefined(info.mtime)?.getTime()),
      Effect.orElseSucceed(() => undefined),
    );
  const times = yield* Effect.forEach(
    paths,
    (relative) =>
      Effect.gen(function* () {
        const absolute = path.join(checkout, relative);
        return (
          (yield* modified(absolute)) ??
          (yield* modified(path.dirname(absolute)))
        );
      }),
    { concurrency: STAT_CONCURRENCY },
  );
  const newest = Math.max(
    ...times.filter((time) => time !== undefined),
    Number.NEGATIVE_INFINITY,
  );
  return Number.isFinite(newest)
    ? Option.getOrUndefined(
        DateTime.make(newest).pipe(Option.map(DateTime.formatIso)),
      )
    : undefined;
});
