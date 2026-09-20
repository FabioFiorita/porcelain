import { execFileSync } from 'node:child_process';
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { devNull, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HistoryCheckout } from './dtos/commit-history.ts';
import { HistoryWorktreeUnavailableError } from './errors/history-worktree-unavailable-error.ts';
import { Git } from './git.ts';

/**
 * Real Git, with a seam after every history read: the hook runs once the
 * child has printed and before anything is done with what it printed.
 *
 * That is the only place a checkout swap can be put deterministically. A test
 * that swaps before the request cannot tell whether a confirmation after the
 * read exists at all, which is what the first version of this test got wrong.
 */
const hooks = vi.hoisted(() => ({
  afterRead: async (_args: readonly string[]) => {},
}));
vi.mock('./read-history.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('./read-history.ts')>();
  return {
    ...real,
    readHistory: async (
      checkout: string,
      args: string[],
      signal?: AbortSignal,
    ) => {
      const output = await real.readHistory(checkout, args, signal);
      await hooks.afterRead(args);
      return output;
    },
  };
});

const { CommitGit } = await import('./commit-git.ts');

describe('history reads and a checkout swapped under them', () => {
  const roots: string[] = [];
  afterEach(async () => {
    hooks.afterRead = async () => {};
    await Promise.all(
      roots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
    );
  });
  function git(path: string, ...args: string[]): string {
    return execFileSync('git', ['-C', path, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_COUNT: '0',
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.test',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.test',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: devNull,
        GIT_CONFIG_PARAMETERS: undefined,
      },
    }).trim();
  }
  async function checkout(path: string): Promise<HistoryCheckout> {
    const { repository } = await new Git(path).listWorktrees();
    const worktree = repository.worktrees.find((entry) => entry.path === path);
    if (!worktree?.metadataIdentity)
      throw new Error('Missing fixture identity');
    return {
      path,
      commonDirectory: repository.commonDirectory,
      administrativeDirectory: worktree.administrativeDirectory,
      repositoryIdentity: repository.repositoryIdentity,
      metadataIdentity: worktree.metadataIdentity,
      scope: 'fixture',
    };
  }

  /**
   * A linked worktree, because that is where the recorded directories live
   * somewhere other than under the checkout and survive the swap untouched.
   */
  async function fixture() {
    const main = await mkdtemp(join(tmpdir(), 'porcelain-history-race-'));
    roots.push(main);
    git(main, 'init', '-b', 'main', '.');
    await writeFile(join(main, 'base.txt'), 'base\n');
    git(main, 'add', '.');
    git(main, 'commit', '-m', 'base');
    const work = join(`${main}-linked`, 'work');
    roots.push(`${main}-linked`);
    git(main, 'worktree', 'add', work, '-b', 'linked');
    // A merge, so there is a second parent to ask about.
    git(work, 'checkout', '-b', 'side');
    await writeFile(join(work, 'side.txt'), 'side\n');
    git(work, 'add', '.');
    git(work, 'commit', '-m', 'side');
    git(work, 'checkout', 'linked');
    await writeFile(join(work, 'main.txt'), 'main\n');
    git(work, 'add', '.');
    git(work, 'commit', '-m', 'main');
    git(work, 'merge', '--no-ff', 'side', '-m', 'merge');
    const impostor = await mkdtemp(join(tmpdir(), 'porcelain-history-other-'));
    roots.push(impostor);
    git(impostor, 'init', '-b', 'main', '.');
    await writeFile(join(impostor, 'other.txt'), 'other\n');
    git(impostor, 'add', '.');
    git(impostor, 'commit', '-m', 'a different repository');
    return {
      work,
      oid: git(work, 'rev-parse', 'HEAD'),
      reader: new CommitGit(await checkout(work)),
      /** Put the other repository where the authorised checkout was. */
      swap: async () => {
        await rename(work, `${work}-moved`);
        roots.push(`${work}-moved`);
        await rename(impostor, work);
      },
    };
  }

  it('refuses a page whose checkout was replaced while Git was reading', async () => {
    const { reader, swap } = await fixture();
    hooks.afterRead = async (args) => {
      if (args[0] !== 'log') return;
      hooks.afterRead = async () => {};
      await swap();
    };
    await expect(reader.listCommits({})).rejects.toBeInstanceOf(
      HistoryWorktreeUnavailableError,
    );
  });

  it('refuses a file list whose checkout was replaced while Git was reading', async () => {
    const { reader, oid, swap } = await fixture();
    hooks.afterRead = async (args) => {
      if (args[0] !== 'show') return;
      hooks.afterRead = async () => {};
      await swap();
    };
    await expect(reader.readCommitFiles({ oid })).rejects.toBeInstanceOf(
      HistoryWorktreeUnavailableError,
    );
  });

  /**
   * The second parent is read by a second process. A confirmation placed after
   * the first one leaves this window open, and an answer built from it is an
   * answer from a repository nobody authorised.
   */
  it('refuses a second-parent file list whose checkout was replaced between its two reads', async () => {
    const { reader, oid, swap } = await fixture();
    hooks.afterRead = async (args) => {
      if (args[0] !== 'diff-tree') return;
      hooks.afterRead = async () => {};
      await swap();
    };
    await expect(
      reader.readCommitFiles({ oid, parent: 2 }),
    ).rejects.toBeInstanceOf(HistoryWorktreeUnavailableError);
  });
});
