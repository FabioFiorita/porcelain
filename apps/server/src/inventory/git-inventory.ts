import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { DiscoveredRepository, GitInventory } from './inventory.ts';

const execute = promisify(execFile);

async function git(path: string, args: string[]): Promise<string> {
  const { stdout } = await execute('git', ['-C', path, ...args], {
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
}

async function identity(path: string): Promise<string> {
  const info = await stat(path, { bigint: true });
  if (info.birthtimeNs === 0n)
    throw new Error(
      'Filesystem birth time is required for conservative identity matching',
    );
  return `${info.dev}:${info.ino}:${info.birthtimeNs}`;
}

export function createGitInventory(): GitInventory {
  return {
    async discover(checkout): Promise<DiscoveredRepository> {
      const commonDirectory = await realpath(
        (
          await git(checkout, [
            'rev-parse',
            '--path-format=absolute',
            '--git-common-dir',
          ])
        ).slice(0, -1),
      );
      const repositoryIdentity = await identity(commonDirectory);
      const output = await git(checkout, [
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
        if (!path || fields.includes('bare'))
          throw new Error('Bare repositories are not supported');
        let metadataIdentity: string;
        let available = true;
        try {
          const directory = (
            await git(path, ['rev-parse', '--absolute-git-dir'])
          ).slice(0, -1);
          const common = (
            await git(path, [
              'rev-parse',
              '--path-format=absolute',
              '--git-common-dir',
            ])
          ).slice(0, -1);
          if ((await identity(common)) !== repositoryIdentity)
            throw new Error('Checkout belongs to another repository');
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
            fields.find((field) => field.startsWith('branch '))?.slice(7) ??
            null,
          available,
        });
      }
      if (worktrees.length === 0) throw new Error('Repository has no checkout');
      return { commonDirectory, repositoryIdentity, worktrees };
    },
  };
}
