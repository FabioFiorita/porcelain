import { DateTime, Effect, FileSystem, Option } from 'effect';
import type { DiscoveredRepository } from '../dtos/discovered-repository.ts';
import { isRepositoryUnavailable } from '../../shared/errors/is-repository-unavailable.ts';
import { parseWorktreeList } from '../parsers/parse-worktree-list.ts';
import {
  contained,
  corroborates,
  readWorktreeRegistry,
  realpathOrSelf,
} from '../../shared/commands/gitdir.ts';
import { identity } from '../../shared/commands/identity.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { gitRead } from '../../shared/commands/run-git.ts';

export const listWorktrees = Effect.fn('Git.listWorktrees')(function* (
  checkout: string,
  limits: GitLimits,
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.access(checkout, { readable: true });
  const location = yield* gitRead(
    checkout,
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    limits,
  );
  const commonDirectory = yield* fs.realPath(
    location.toString('utf8').slice(0, -1),
  );
  const repositoryIdentity = yield* identity(commonDirectory);
  const inventory = yield* gitRead(
    checkout,
    ['worktree', 'list', '--porcelain', '-z'],
    limits,
  );
  const records = yield* parseWorktreeList(inventory.toString('utf8'));
  const registry = yield* readWorktreeRegistry(commonDirectory);
  const committedAt = yield* readCommitTimes(
    checkout,
    records.flatMap((record) => (record.head ? [record.head] : [])),
    limits,
  );
  const worktrees = yield* Effect.forEach(records, (record, index) =>
    Effect.gen(function* () {
      const administrativeDirectory =
        index === 0
          ? commonDirectory
          : (registry.get(yield* realpathOrSelf(record.path)) ??
            registry.get(record.path));
      const inspection = yield* inspectWorktree(
        record.path,
        administrativeDirectory,
        commonDirectory,
      );
      return {
        path: record.path,
        metadataIdentity: inspection.metadataIdentity,
        administrativeDirectory: administrativeDirectory ?? '',
        main: index === 0,
        branch: record.branch,
        headCommittedAt: committedAt.get(record.head ?? '') ?? null,
        available: inspection.available,
      };
    }),
  );
  return {
    commonDirectory,
    repositoryIdentity,
    worktrees,
  } satisfies DiscoveredRepository;
});

const readCommitTimes = Effect.fn('Git.readCommitTimes')(function* (
  checkout: string,
  commits: readonly string[],
  limits: GitLimits,
) {
  const unique = [...new Set(commits)];
  if (unique.length === 0) return new Map<string, string>();
  const output = yield* gitRead(
    checkout,
    [
      'log',
      '--no-walk',
      '--ignore-missing',
      '--format=%H %ct',
      ...unique,
      '--',
    ],
    limits,
  ).pipe(Effect.orElseSucceed(() => Buffer.alloc(0)));
  return new Map(
    output
      .toString('utf8')
      .split('\n')
      .flatMap((line) => {
        const [commit, seconds] = line.split(' ');
        const committed = DateTime.make(Number(seconds) * 1000);
        return commit && Option.isSome(committed)
          ? [[commit, DateTime.formatIso(committed.value)] as const]
          : [];
      }),
  );
});

const unidentified = { metadataIdentity: null, available: false } as const;

const inspectWorktree = Effect.fn('Git.inspectWorktree')(function* (
  path: string,
  administrativeDirectory: string | undefined,
  commonDirectory: string,
) {
  if (
    !administrativeDirectory ||
    !(yield* contained(administrativeDirectory, commonDirectory))
  )
    return unidentified;
  const metadataIdentity = yield* identity(administrativeDirectory).pipe(
    Effect.catchIf(isRepositoryUnavailable, () => Effect.succeed(undefined)),
  );
  if (metadataIdentity === undefined) return unidentified;
  const available =
    (yield* reachable(path)) &&
    (yield* corroborates(path, administrativeDirectory));
  return { metadataIdentity, available };
});

const reachable = Effect.fn('Git.reachable')(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.stat(path).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false),
  );
});
