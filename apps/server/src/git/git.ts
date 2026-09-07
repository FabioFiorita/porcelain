import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import {
  GitCommandError,
  InvalidWorktreeInventoryError,
  RepositoryIdentityMismatchError,
  UnsupportedFilesystemIdentityError,
  UnsupportedRepositoryError,
} from './git-errors.ts';
import type {
  DiscoveredRepository,
  WorktreeReader,
} from './worktree-inventory.ts';

const execute = promisify(execFile);

async function identity(path: string): Promise<string> {
  const info = await stat(path, { bigint: true });
  if (info.birthtimeNs === 0n) throw new UnsupportedFilesystemIdentityError();
  return `${info.dev}:${info.ino}:${info.birthtimeNs}`;
}

export class Git implements WorktreeReader {
  private readonly checkout: string;

  constructor(checkout: string) {
    this.checkout = checkout;
  }

  private async command(args: string[]): Promise<string> {
    try {
      const { stdout } = await execute('git', ['-C', this.checkout, ...args], {
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 4 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_OPTIONAL_LOCKS: '0',
          GIT_DIR: undefined,
          GIT_WORK_TREE: undefined,
          GIT_COMMON_DIR: undefined,
        },
      });
      return stdout;
    } catch (cause) {
      throw new GitCommandError(this.checkout, args, cause);
    }
  }

  async listWorktrees(): Promise<DiscoveredRepository> {
    const commonDirectory = await realpath(
      (
        await this.command([
          'rev-parse',
          '--path-format=absolute',
          '--git-common-dir',
        ])
      ).slice(0, -1),
    );
    const repositoryIdentity = await identity(commonDirectory);
    const output = await this.command([
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
      if (!path)
        throw new InvalidWorktreeInventoryError('Missing worktree path');
      let metadataIdentity: string;
      let available = true;
      try {
        const worktreeGit = new Git(path);
        const directory = (
          await worktreeGit.command(['rev-parse', '--absolute-git-dir'])
        ).slice(0, -1);
        const common = (
          await worktreeGit.command([
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
}
