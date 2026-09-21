import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { commitPaths } from './commit-paths.ts';

it('keeps the real index lock and temporary index when commit process ownership is lost', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-selected-quarantine-'));
  const index = join(root, 'index');
  await writeFile(index, 'original index');
  const runner: GitProcessRunner = {
    async execute(args) {
      if (args.includes('commit'))
        throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
      const gitPath = args.at(-1) ?? '';
      return {
        stdout: Buffer.from(
          args.includes('--git-path')
            ? gitPath === 'index'
              ? index
              : join(root, gitPath)
            : args.includes('rev-parse')
              ? `${'a'.repeat(40)}\n`
              : args.includes('symbolic-ref')
                ? 'main\n'
                : args.includes('ls-files')
                  ? 'file\0'
                  : '',
        ),
        exitCode: args.includes('diff') ? 1 : 0,
        started: true,
        interrupted: false,
        descendantsStopped: true,
      };
    },
  };
  try {
    await expect(
      commitPaths(
        runner,
        {
          id: 'test',
          intent: { action: 'commit', message: 'test', paths: ['file'] },
          preview: {
            headOid: 'a'.repeat(40),
            branch: 'main',
            staged: true,
            trackedChanges: true,
            untrackedCount: 0,
          },
        },
        AbortSignal.timeout(5000),
      ),
    ).rejects.toMatchObject({ reason: 'PROCESS_GROUP_UNCONFIRMED' });
    expect(await readFile(index, 'utf8')).toBe('original index');
    expect(await readdir(root)).toEqual(
      expect.arrayContaining(['index', 'index.lock']),
    );
    expect(
      (await readdir(root)).some((path) => path.startsWith('porcelain-index-')),
    ).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
