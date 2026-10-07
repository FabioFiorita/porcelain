import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { ListedWorktree } from '@porcelain/projects/models';
import {
  ListedWorktreeAccessReader,
  WorktreeCatalogStore,
} from '@porcelain/projects/ports';
import { gitWorktree } from '../../../spec/fixtures/git-worktree.ts';
import { gitWorktreeAccessReaderLayer } from './git-worktree-access-reader.ts';

let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'porcelain-access-')));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function known(worktree: ListedWorktree, requested = worktree.id) {
  const catalog: WorktreeCatalogStore = {
    find: (input) =>
      input.worktreeId === worktree.id
        ? {
            worktree,
            observation: {
              id: worktree.projectId,
              commonDirectory: worktree.commonDirectory,
              repositoryIdentity: worktree.repositoryIdentity,
              observedAt: '2026-01-01T00:00:00Z',
              listed: true,
            },
          }
        : undefined,
    lastSeen: () => [worktree],
    listObservations: () => [],
    save: () => undefined,
  };
  return Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* ListedWorktreeAccessReader).known({
        worktreeId: requested,
      });
    }).pipe(
      Effect.provide(
        gitWorktreeAccessReaderLayer.pipe(
          Layer.provide(
            Layer.mergeAll(
              NodeServices.layer,
              Layer.succeed(WorktreeCatalogStore, catalog),
            ),
          ),
        ),
      ),
    ),
  );
}

describe('native worktree access', () => {
  it('reads the current branch from the real checkout and refuses an unknown id', async () => {
    const worktree = repository(root);
    execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/renamed'], {
      cwd: worktree.path,
    });
    expect(await known(worktree)).toEqual({
      kind: 'found',
      worktree: { ...worktree, branch: 'refs/heads/renamed' },
    });
    expect(await known(worktree, 'unknown')).toEqual({ kind: 'missing' });
  });

  it('refuses removed metadata and metadata replaced by another repository', async () => {
    const worktree = repository(root);
    renameSync(worktree.administrativeDirectory, join(root, 'saved-git'));
    expect(await known(worktree)).toEqual({ kind: 'unavailable' });
    execFileSync('git', ['init', '-q', worktree.path]);
    expect(await known(worktree)).toEqual({ kind: 'unavailable' });
  });

  it('reports a missing checkout as unavailable while retaining its administrative identity', async () => {
    const main = repository(root);
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.com',
        'commit',
        '-q',
        '--allow-empty',
        '-m',
        'start',
      ],
      { cwd: main.path },
    );
    const linkedPath = join(root, 'linked');
    execFileSync(
      'git',
      ['worktree', 'add', '-q', '-b', 'feature', linkedPath],
      { cwd: main.path },
    );
    const administrativeDirectory = join(
      main.commonDirectory,
      'worktrees',
      'linked',
    );
    const info = statSync(administrativeDirectory, { bigint: true });
    const linked = {
      ...main,
      path: linkedPath,
      main: false,
      branch: 'refs/heads/feature',
      administrativeDirectory,
      metadataIdentity: `${info.dev}:${info.ino}:${info.birthtimeNs}`,
    };
    expect(await known(linked)).toEqual({ kind: 'found', worktree: linked });
    rmSync(linkedPath, { recursive: true });
    expect(await known(linked)).toEqual({
      kind: 'found',
      worktree: { ...linked, available: false },
    });
  });
});

function repository(root: string) {
  execFileSync('git', ['init', '-q', '-b', 'main', join(root, 'main')]);
  return gitWorktree(root);
}
