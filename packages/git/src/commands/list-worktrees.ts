import { realpath, stat } from 'node:fs/promises';
import type { DiscoveredRepository } from '../dtos/discovered-repository.ts';
import type { DiscoveryIssue } from '../dtos/discovery-issue.ts';
import type { DiscoveryResult } from '../dtos/discovery-result.ts';
import { InvalidWorktreeInventoryError } from '../errors/invalid-worktree-inventory-error.ts';
import { isRepositoryUnavailable } from '../errors/is-repository-unavailable.ts';
import { RepositoryIdentityMismatchError } from '../errors/repository-identity-mismatch-error.ts';
import { UnsupportedRepositoryError } from '../errors/unsupported-repository-error.ts';
import { runGitRead } from '../run-git.ts';
import {
  contained,
  corroborates,
  identity,
  readWorktreeRegistry,
  realpathOrSelf,
} from '../worktree-registry.ts';

export async function listWorktrees(
  checkout: string,
  signal?: AbortSignal,
  known?: { commonDirectory: string },
): Promise<DiscoveryResult> {
  const issues: DiscoveryIssue[] = [];
  // A registered project brings its own common directory, so the only Git
  // process a listing costs is the listing itself. Identity is still read
  // from the filesystem below, and the caller still refuses a listing whose
  // repository is not the one it registered.
  const commonDirectory = await realpath(
    known?.commonDirectory ??
      (
        await runGitRead(
          checkout,
          ['rev-parse', '--path-format=absolute', '--git-common-dir'],
          signal,
        )
      )
        .toString('utf8')
        .slice(0, -1),
  );
  const repositoryIdentity = await identity(commonDirectory);
  const output = (
    await runGitRead(
      checkout,
      ['worktree', 'list', '--porcelain', '-z'],
      signal,
    )
  ).toString('utf8');
  const registry = await readWorktreeRegistry(commonDirectory);
  const records = output.split('\0\0').filter(Boolean);
  const worktrees: DiscoveredRepository['worktrees'] = [];
  for (const [index, record] of records.entries()) {
    const fields = record.split('\0');
    const path = fields
      .find((field) => field.startsWith('worktree '))
      ?.slice(9);
    if (fields.includes('bare')) throw new UnsupportedRepositoryError();
    if (!path) throw new InvalidWorktreeInventoryError('Missing worktree path');
    // A checkout folder someone deleted leaves a prunable record behind. It is
    // not an omission: the administrative directory is still there, so the
    // worktree still has an identity and an id. Dropping it here would tell
    // the server that Git had stopped reporting it, which is what starts the
    // clock on its review data — for a worktree `git worktree repair` can
    // still bring back.
    const administrativeDirectory =
      index === 0
        ? commonDirectory
        : (registry.get(await realpathOrSelf(path)) ?? registry.get(path));
    const inspection = await inspectWorktree(
      path,
      administrativeDirectory,
      commonDirectory,
    );
    issues.push(...inspection.issues);
    worktrees.push({
      path,
      metadataIdentity: inspection.metadataIdentity,
      administrativeDirectory: administrativeDirectory ?? '',
      main: index === 0,
      branch:
        fields.find((field) => field.startsWith('branch '))?.slice(7) ?? null,
      available: inspection.available,
    });
  }
  if (worktrees.length === 0)
    throw new InvalidWorktreeInventoryError('Repository has no checkout');
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
      issues: [
        {
          path,
          error: new InvalidWorktreeInventoryError(
            'Worktree has no administrative directory in this repository',
          ),
        },
      ],
    };
  try {
    const metadataIdentity = await identity(administrativeDirectory);
    // Identity survives an unreachable checkout; availability does not, and
    // the reason is still reported so the owner learns why.
    const failure = await unreachable(path);
    if (failure)
      return {
        metadataIdentity,
        available: false,
        issues: [{ path, error: failure }],
      };
    // Readable, so the checkout itself must agree it is this worktree.
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

/** Null when the checkout can be read, otherwise why it could not. */
async function unreachable(path: string): Promise<Error | null> {
  try {
    await stat(path);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
