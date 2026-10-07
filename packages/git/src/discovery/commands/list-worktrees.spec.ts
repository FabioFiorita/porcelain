import { NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listWorktrees } from './list-worktrees.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'porcelain-worktrees-')));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]) {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function repositoryWithFeature() {
  const main = join(root, 'main');
  const feature = join(root, 'feature');
  git(root, 'init', '-q', '-b', 'main', main);
  git(
    main,
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'start',
  );
  git(main, 'worktree', 'add', '-q', '-b', 'feature', feature);
  return { main, feature };
}

function list(checkout: string) {
  return Effect.runPromise(
    listWorktrees(checkout, gitLimits).pipe(Effect.provide(NodeServices.layer)),
  );
}

function refusal(checkout: string) {
  return Effect.runPromise(
    Effect.flip(listWorktrees(checkout, gitLimits)).pipe(
      Effect.provide(NodeServices.layer),
    ),
  );
}

describe('listWorktrees', () => {
  it('lists the main checkout and its linked worktrees from any of them', async () => {
    const { main, feature } = repositoryWithFeature();
    const repository = await list(feature);
    expect(repository.commonDirectory).toBe(join(main, '.git'));
    expect(repository.repositoryIdentity).toMatch(/^\d+:\d+:\d+$/);
    expect(
      repository.worktrees.map(
        ({ path, administrativeDirectory, main, branch, available }) => ({
          path,
          administrativeDirectory,
          main,
          branch,
          available,
        }),
      ),
    ).toEqual([
      {
        path: main,
        administrativeDirectory: join(main, '.git'),
        main: true,
        branch: 'refs/heads/main',
        available: true,
      },
      {
        path: feature,
        administrativeDirectory: join(main, '.git', 'worktrees', 'feature'),
        main: false,
        branch: 'refs/heads/feature',
        available: true,
      },
    ]);
    expect(
      repository.worktrees.every(({ metadataIdentity }) =>
        /^\d+:\d+:\d+$/.test(metadataIdentity ?? ''),
      ),
    ).toBe(true);
  });

  it('keeps a linked worktree whose folder is gone, as unavailable', async () => {
    const { main, feature } = repositoryWithFeature();
    rmSync(feature, { recursive: true, force: true });
    const repository = await list(main);
    expect(repository.worktrees[1]).toMatchObject({
      path: feature,
      available: false,
    });
    expect(repository.worktrees[1]?.metadataIdentity).toMatch(/^\d+:\d+:\d+$/);
  });

  it('fails with the Git refusal for a folder that is not a repository', async () => {
    expect(await refusal(root)).toMatchObject({
      _tag: 'GitCommandError',
      exitCode: 128,
    });
  });

  it('refuses a bare repository', async () => {
    const bare = join(root, 'bare.git');
    git(root, 'init', '-q', '--bare', bare);
    expect((await refusal(bare))._tag).toBe('UnsupportedRepositoryError');
  });
});
