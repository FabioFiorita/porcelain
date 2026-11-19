import { DateTime, Effect, FileSystem, Option, Path } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { gitRead } from '../../shared/commands/run-git.ts';

const STAT_CONCURRENCY = 16;

export type UncommittedActivity =
  | { readonly kind: 'clean' }
  | { readonly kind: 'dated'; readonly at: string };

const clean: UncommittedActivity = { kind: 'clean' };
const dated = (at: string): UncommittedActivity => ({ kind: 'dated', at });

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
    .flatMap((record) => (record.length > 3 ? [record.slice(3)] : []));
  if (paths.length === 0) return clean;
  const modified = (target: string) =>
    fs.stat(target).pipe(
      Effect.map((info) => Option.getOrUndefined(info.mtime)?.getTime()),
      Effect.orElseSucceed(() => undefined),
    );
  const surviving = Effect.fn('Git.survivingChangeTime')(function* (
    absolute: string,
  ) {
    let target = absolute;
    for (;;) {
      const time = yield* modified(target);
      if (time !== undefined || target === checkout) return time;
      const parent = path.dirname(target);
      if (parent === target) return undefined;
      target = parent;
    }
  });
  const times = yield* Effect.forEach(
    paths,
    (relative) => surviving(path.join(checkout, relative)),
    { concurrency: STAT_CONCURRENCY },
  );
  const newest = times.reduce<number | undefined>(
    (latest, time) =>
      time === undefined || (latest !== undefined && latest >= time)
        ? latest
        : time,
    undefined,
  );
  const at =
    newest === undefined
      ? undefined
      : Option.getOrUndefined(
          DateTime.make(newest).pipe(Option.map(DateTime.formatIso)),
        );
  return at === undefined ? clean : dated(at);
});
