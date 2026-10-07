import { Effect } from 'effect';
import { realpath, stat } from 'node:fs/promises';
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
import { readMetadata } from '../../shared/commands/read-metadata.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { gitRead } from '../../shared/commands/run-git.ts';

export const listWorktrees = Effect.fn('Git.listWorktrees')(function* (
  checkout: string,
  limits: GitLimits,
) {
  const location = yield* gitRead(
    checkout,
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    limits,
  );
  const commonDirectory = yield* readMetadata(() =>
    realpath(location.toString('utf8').slice(0, -1)),
  );
  const repositoryIdentity = yield* readMetadata(() =>
    identity(commonDirectory),
  );
  const inventory = yield* gitRead(
    checkout,
    ['worktree', 'list', '--porcelain', '-z'],
    limits,
  );
  const records = yield* parseWorktreeList(inventory.toString('utf8'));
  const registry = yield* readMetadata(() =>
    readWorktreeRegistry(commonDirectory),
  );
  const worktrees = yield* Effect.forEach(records, (record, index) =>
    Effect.gen(function* () {
      const administrativeDirectory =
        index === 0
          ? commonDirectory
          : (registry.get(
              yield* readMetadata(() => realpathOrSelf(record.path)),
            ) ?? registry.get(record.path));
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

const unidentified = { metadataIdentity: null, available: false } as const;

const inspectWorktree = Effect.fn('Git.inspectWorktree')(function* (
  path: string,
  administrativeDirectory: string | undefined,
  commonDirectory: string,
) {
  if (
    !administrativeDirectory ||
    !(yield* readMetadata(() =>
      contained(administrativeDirectory, commonDirectory),
    ))
  )
    return unidentified;
  const metadataIdentity = yield* readMetadata(() =>
    identity(administrativeDirectory),
  ).pipe(
    Effect.catchIf(isRepositoryUnavailable, () => Effect.succeed(undefined)),
  );
  if (metadataIdentity === undefined) return unidentified;
  const available =
    (yield* reachable(path)) &&
    (yield* readMetadata(() => corroborates(path, administrativeDirectory)));
  return { metadataIdentity, available };
});

const reachable = (path: string) =>
  readMetadata(() => stat(path)).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false),
  );
