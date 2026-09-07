import { realpath, stat } from 'node:fs/promises';
import { InvalidWorktreeInventoryError } from '../errors/invalid-worktree-inventory-error.ts';
import { RepositoryIdentityMismatchError } from '../errors/repository-identity-mismatch-error.ts';
import { UnsupportedFilesystemIdentityError } from '../errors/unsupported-filesystem-identity-error.ts';
import { UnsupportedRepositoryError } from '../errors/unsupported-repository-error.ts';
import { executeCommand } from '../execute-command.ts';
import type { DiscoveredRepository } from './worktree-inventory.ts';

async function identity(path: string): Promise<string> {
  const info = await stat(path, { bigint: true });
  if (info.birthtimeNs === 0n) throw new UnsupportedFilesystemIdentityError();
  return `${info.dev}:${info.ino}:${info.birthtimeNs}`;
}

export async function listWorktrees(
  checkout: string,
): Promise<DiscoveredRepository> {
  const commonDirectory = await realpath(
    (
      await executeCommand(checkout, [
        'rev-parse',
        '--path-format=absolute',
        '--git-common-dir',
      ])
    ).slice(0, -1),
  );
  const repositoryIdentity = await identity(commonDirectory);
  const output = await executeCommand(checkout, [
    'worktree',
    'list',
    '--porcelain',
    '-z',
  ]);
  const records = output.split('\0\0').filter(Boolean);
  const worktrees: DiscoveredRepository['worktrees'] = [];
  for (const [index, record] of records.entries()) {
    const fields = record.split('\0');
    const path = fields
      .find((field) => field.startsWith('worktree '))
      ?.slice(9);
    if (fields.includes('bare')) throw new UnsupportedRepositoryError();
    if (!path) throw new InvalidWorktreeInventoryError('Missing worktree path');
    let metadataIdentity: string;
    let available = true;
    try {
      const directory = (
        await executeCommand(path, ['rev-parse', '--absolute-git-dir'])
      ).slice(0, -1);
      const common = (
        await executeCommand(path, [
          'rev-parse',
          '--path-format=absolute',
          '--git-common-dir',
        ])
      ).slice(0, -1);
      if ((await identity(common)) !== repositoryIdentity)
        throw new RepositoryIdentityMismatchError();
      metadataIdentity = await identity(directory);
    } catch {
      // Git still lists this checkout, but it cannot currently be inspected.
      metadataIdentity = '';
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
  return { commonDirectory, repositoryIdentity, worktrees };
}
