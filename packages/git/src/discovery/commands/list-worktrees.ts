import { realpath, stat } from 'node:fs/promises';
import type { DiscoveredRepository } from '../dtos/discovered-repository.ts';
import type { DiscoveryIssue } from '../dtos/discovery-issue.ts';
import type { DiscoveryResult } from '../dtos/discovery-result.ts';
import { InvalidWorktreeInventoryError } from '../errors/invalid-worktree-inventory-error.ts';
import { isRepositoryUnavailable } from '../errors/is-repository-unavailable.ts';
import { RepositoryIdentityMismatchError } from '../errors/repository-identity-mismatch-error.ts';
import { parseWorktreeList } from '../parsers/parse-worktree-list.ts';
import {
  contained,
  corroborates,
  readWorktreeRegistry,
  realpathOrSelf,
} from '../../shared/gitdir.ts';
import { identity } from '../../shared/identity.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runGitRead } from '../../shared/run-git.ts';

export async function listWorktrees(
  checkout: string,
  limits: GitLimits,
  signal?: AbortSignal,
  known?: { commonDirectory: string },
): Promise<DiscoveryResult> {
  const issues: DiscoveryIssue[] = [];
  const commonDirectory = await realpath(
    known?.commonDirectory ??
      (
        await runGitRead(
          checkout,
          ['rev-parse', '--path-format=absolute', '--git-common-dir'],
          limits,
          signal,
        )
      )
        .toString('utf8')
        .slice(0, -1),
  );
  const repositoryIdentity = await identity(commonDirectory);
  const records = parseWorktreeList(
    (
      await runGitRead(
        checkout,
        ['worktree', 'list', '--porcelain', '-z'],
        limits,
        signal,
      )
    ).toString('utf8'),
  );
  const registry = await readWorktreeRegistry(commonDirectory);
  const worktrees: DiscoveredRepository['worktrees'] = [];
  for (const [index, record] of records.entries()) {
    const administrativeDirectory =
      index === 0
        ? commonDirectory
        : (registry.get(await realpathOrSelf(record.path)) ??
          registry.get(record.path));
    const inspection = await inspectWorktree(
      record.path,
      administrativeDirectory,
      commonDirectory,
    );
    issues.push(...inspection.issues);
    worktrees.push({
      path: record.path,
      metadataIdentity: inspection.metadataIdentity,
      administrativeDirectory: administrativeDirectory ?? '',
      main: index === 0,
      branch: record.branch,
      available: inspection.available,
    });
  }
  signal?.throwIfAborted();
  return {
    repository: { commonDirectory, repositoryIdentity, worktrees },
    issues,
  };
}

async function inspectWorktree(
  path: string,
  administrativeDirectory: string | undefined,
  commonDirectory: string,
): Promise<{
  metadataIdentity: string | null;
  available: boolean;
  issues: DiscoveryIssue[];
}> {
  if (
    !administrativeDirectory ||
    !(await contained(administrativeDirectory, commonDirectory))
  )
    return {
      metadataIdentity: null,
      available: false,
      issues: [{ path, error: new InvalidWorktreeInventoryError() }],
    };
  try {
    const metadataIdentity = await identity(administrativeDirectory);
    const failure = await unreachable(path);
    if (failure)
      return {
        metadataIdentity,
        available: false,
        issues: [{ path, error: failure }],
      };
    if (!(await corroborates(path, administrativeDirectory)))
      return {
        metadataIdentity,
        available: false,
        issues: [{ path, error: new RepositoryIdentityMismatchError() }],
      };
    return { metadataIdentity, available: true, issues: [] };
  } catch (error) {
    if (!isRepositoryUnavailable(error)) throw error;
    return {
      metadataIdentity: null,
      available: false,
      issues: [{ path, error }],
    };
  }
}

async function unreachable(path: string): Promise<Error | undefined> {
  try {
    await stat(path);
    return undefined;
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
}
