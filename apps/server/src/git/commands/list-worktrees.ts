import { realpath, stat } from 'node:fs/promises';
import type { DiscoveredRepository } from '../dtos/discovered-repository.ts';
import type { DiscoveryIssue } from '../dtos/discovery-issue.ts';
import type { DiscoveryResult } from '../dtos/discovery-result.ts';
import { InvalidWorktreeInventoryError } from '../errors/invalid-worktree-inventory-error.ts';
import { isRepositoryUnavailable } from '../errors/is-repository-unavailable.ts';
import { RepositoryIdentityMismatchError } from '../errors/repository-identity-mismatch-error.ts';
import { UnsupportedFilesystemIdentityError } from '../errors/unsupported-filesystem-identity-error.ts';
import { UnsupportedRepositoryError } from '../errors/unsupported-repository-error.ts';
import { executeCommand } from '../execute-command.ts';

async function identity(path: string): Promise<string> {
  const info = await stat(path, { bigint: true });
  if (info.birthtimeNs === 0n) throw new UnsupportedFilesystemIdentityError();
  return `${info.dev}:${info.ino}:${info.birthtimeNs}`;
}

export async function listWorktrees(
  checkout: string,
  signal?: AbortSignal,
): Promise<DiscoveryResult> {
  const issues: DiscoveryIssue[] = [];
  const commonDirectory = await realpath(
    (
      await executeCommand(
        checkout,
        ['rev-parse', '--path-format=absolute', '--git-common-dir'],
        signal,
      )
    ).slice(0, -1),
  );
  const repositoryIdentity = await identity(commonDirectory);
  const output = await executeCommand(
    checkout,
    ['worktree', 'list', '--porcelain', '-z'],
    signal,
  );
  const records = output.split('\0\0').filter(Boolean);
  const worktrees: DiscoveredRepository['worktrees'] = [];
  for (const [index, record] of records.entries()) {
    const fields = record.split('\0');
    const path = fields
      .find((field) => field.startsWith('worktree '))
      ?.slice(9);
    if (fields.includes('bare')) throw new UnsupportedRepositoryError();
    if (!path) throw new InvalidWorktreeInventoryError('Missing worktree path');
    let metadataIdentity: string | null;
    let available = true;
    try {
      const directory = (
        await executeCommand(path, ['rev-parse', '--absolute-git-dir'], signal)
      ).slice(0, -1);
      const common = (
        await executeCommand(
          path,
          ['rev-parse', '--path-format=absolute', '--git-common-dir'],
          signal,
        )
      ).slice(0, -1);
      if ((await identity(common)) !== repositoryIdentity)
        throw new RepositoryIdentityMismatchError();
      metadataIdentity = await identity(directory);
    } catch (error) {
      signal?.throwIfAborted();
      if (!isRepositoryUnavailable(error)) throw error;
      issues.push({ path, error });
      metadataIdentity = null;
      available = false;
    }
    worktrees.push({
      path,
      metadataIdentity,
      main: index === 0,
      branch:
        fields.find((field) => field.startsWith('branch '))?.slice(7) ?? null,
      available,
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
