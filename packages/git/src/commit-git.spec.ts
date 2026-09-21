import { execFileSync } from 'node:child_process';
import {
  appendFile,
  mkdtemp,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { devNull, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CommitGit } from './commit-git.ts';
import type { HistoryCheckout } from './dtos/commit-history.ts';
import { HistoryWorktreeUnavailableError } from './errors/history-worktree-unavailable-error.ts';
import { InvalidHistoryRequestError } from './errors/invalid-history-request-error.ts';
import { UnsupportedHistoryDataError } from './errors/unsupported-history-data-error.ts';
import { Git } from './git.ts';

describe('CommitGit', () => {
  const roots: string[] = [];
  afterEach(async () => {
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
  async function repository(commits = 0) {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-history-'));
    roots.push(root);
    git(root, 'init', '-b', 'main', '.');
    for (let index = 1; index <= commits; index += 1) {
      await writeFile(join(root, 'file.txt'), `${index}\n`);
      git(root, 'add', 'file.txt');
      git(root, 'commit', '-m', `commit ${index}`);
    }
    return { root, reader: new CommitGit(await checkout(root)) };
  }
  const subjects = (page: { commits: { subject: string }[] }) =>
    page.commits.map((commit) => commit.subject);
  /** Every page, in order, as one list — what the reader ends up scrolling. */
  async function pageThrough(reader: CommitGit, limit: number) {
    const all: string[] = [];
    let after: string[] | null = null;
    let tip: string | null = null;
    for (let guard = 0; guard < 50; guard += 1) {
      const page = await reader.listCommits({
        limit,
        ...(after && tip ? { after, tip } : {}),
      });
      all.push(...subjects(page));
      after = page.nextAfter;
      tip = page.tip ?? tip;
      if (!after) break;
    }
    return all;
  }

  it('reads the newest commits and where HEAD is', async () => {
    const { reader } = await repository(3);
    const page = await reader.listCommits({});
    expect(subjects(page)).toEqual(['commit 3', 'commit 2', 'commit 1']);
    expect(page.snapshot?.head).toEqual({
      kind: 'attached',
      ref: 'refs/heads/main',
    });
    expect(page.commits[0]?.refs).toEqual(['main']);
    expect(page.nextAfter).toBeNull();
    expect(page.restarted).toBe(false);
  });

  it('answers a branch with no commits yet without failing', async () => {
    const { reader } = await repository();
    const page = await reader.listCommits({});
    expect(page.commits).toEqual([]);
    expect(page.snapshot).toEqual({
      tipOid: null,
      head: { kind: 'unborn', ref: 'refs/heads/main' },
    });
  });

  it('reports a detached HEAD', async () => {
    const { root, reader } = await repository(2);
    git(root, 'checkout', '--detach', 'HEAD');
    expect((await reader.listCommits({})).snapshot?.head).toEqual({
      kind: 'detached',
    });
  });

  /**
   * The property the signed cursor existed to provide, now coming from the
   * shape of the graph: pages are anchored to a commit, so commits arriving at
   * the top while somebody reads cannot shift what the next page holds.
   */
  it('continues after the last commit shown, with no gap and no repeat', async () => {
    const { root, reader } = await repository(12);
    const first = await reader.listCommits({ limit: 5 });
    expect(subjects(first)).toEqual([
      'commit 12',
      'commit 11',
      'commit 10',
      'commit 9',
      'commit 8',
    ]);
    // Somebody commits while the reader is part-way down the list.
    await writeFile(join(root, 'file.txt'), 'newer\n');
    git(root, 'add', 'file.txt');
    git(root, 'commit', '-m', 'arrived later');

    const second = await reader.listCommits({
      limit: 5,
      ...(first.nextAfter && first.tip
        ? { after: first.nextAfter, tip: first.tip }
        : {}),
    });
    expect(subjects(second)).toEqual([
      'commit 7',
      'commit 6',
      'commit 5',
      'commit 4',
      'commit 3',
    ]);
    // A continuation never looked at the branch, so it says nothing about it.
    expect(second.snapshot).toBeNull();
    expect(second.restarted).toBe(false);
    const third = await reader.listCommits({
      limit: 5,
      ...(second.nextAfter && first.tip
        ? { after: second.nextAfter, tip: first.tip }
        : {}),
    });
    expect(subjects(third)).toEqual(['commit 2', 'commit 1']);
    expect(third.nextAfter).toBeNull();
  });

  /**
   * A reset leaves the commit that was being paged from in place as an object,
   * so walking from it would print a history this branch no longer has. The
   * reader is told the list restarted instead.
   */
  it('restarts from the top when a reset takes the anchor off the branch', async () => {
    const { root, reader } = await repository(12);
    const first = await reader.listCommits({ limit: 5 });
    git(root, 'reset', '--hard', 'HEAD~6');
    await writeFile(join(root, 'after.txt'), 'x\n');
    git(root, 'add', 'after.txt');
    git(root, 'commit', '-m', 'after the reset');

    const next = await reader.listCommits({
      limit: 5,
      ...(first.nextAfter && first.tip
        ? { after: first.nextAfter, tip: first.tip }
        : {}),
    });
    expect(next.restarted).toBe(true);
    expect(subjects(next)[0]).toBe('after the reset');
    // Restarting is a page from the top, so it says where HEAD is again.
    expect(next.snapshot?.head).toEqual({
      kind: 'attached',
      ref: 'refs/heads/main',
    });
  });

  it('restarts from the top when a rebase rewrites the anchor', async () => {
    const { root, reader } = await repository(6);
    const first = await reader.listCommits({ limit: 3 });
    const anchor = first.nextAfter;
    const startedAt = first.tip;
    // Replaying onto a different base is what guarantees new object ids:
    // rebasing onto the same parent with the same trees and timestamps can
    // reproduce the commits exactly, which would not be a rewrite at all.
    git(root, 'branch', 'elsewhere', 'HEAD~5');
    git(root, 'checkout', 'elsewhere');
    await writeFile(join(root, 'other.txt'), 'other\n');
    git(root, 'add', 'other.txt');
    git(root, 'commit', '-m', 'a different base');
    git(root, 'checkout', 'main');
    git(root, 'rebase', '--onto', 'elsewhere', 'main~5', 'main');
    // The commit the reader is holding still exists; it is simply no longer
    // part of this branch, which is exactly the case that must be caught.
    expect(git(root, 'cat-file', '-t', startedAt ?? '')).toBe('commit');

    const next = await reader.listCommits({
      limit: 3,
      ...(anchor && startedAt ? { after: anchor, tip: startedAt } : {}),
    });
    expect(next.restarted).toBe(true);
    expect(subjects(next)).toEqual(['commit 6', 'commit 5', 'commit 4']);
  });

  /**
   * The defect a single-commit anchor has in any history with merges: the
   * commit that ends a page is not an ancestor of the branches running beside
   * it, so continuing from it alone drops them with no error and no race.
   */
  it('loses no branch when a page ends at a merge boundary', async () => {
    const { root } = await repository();
    await writeFile(join(root, 'r.txt'), 'r\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'root');
    git(root, 'checkout', '-b', 'side');
    await writeFile(join(root, 's.txt'), 's\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'side');
    git(root, 'checkout', 'main');
    await writeFile(join(root, 'm.txt'), 'm\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'main');
    git(root, 'merge', '--no-ff', 'side', '-m', 'merge');
    const reader = new CommitGit(await checkout(root));

    // Two at a time, so a page ends inside the merge.
    expect(await pageThrough(reader, 2)).toEqual(
      git(root, 'log', '--topo-order', '--format=%s').split('\n'),
    );
  });

  it('pages a wider history in the same order as one walk', async () => {
    const { root } = await repository(3);
    for (const branch of ['one', 'two', 'three']) {
      git(root, 'checkout', '-b', branch, 'main~1');
      await writeFile(join(root, `${branch}.txt`), branch);
      git(root, 'add', '.');
      git(root, 'commit', '-m', `on ${branch}`);
      git(root, 'checkout', 'main');
      git(root, 'merge', '--no-ff', branch, '-m', `merge ${branch}`);
    }
    const reader = new CommitGit(await checkout(root));
    expect(await pageThrough(reader, 2)).toEqual(
      git(root, 'log', '--topo-order', '--format=%s').split('\n'),
    );
  });

  /**
   * A rewrite whose old commits have since been collected. The anchor is not
   * merely off the branch, it is gone, and Git reports that as a fatal unknown
   * revision rather than a plain "no".
   */
  it('restarts from the top when the commit it started at has been pruned', async () => {
    const { root, reader } = await repository(8);
    const first = await reader.listCommits({ limit: 3 });
    git(root, 'reset', '--hard', 'HEAD~4');
    git(root, 'reflog', 'expire', '--expire=now', '--all');
    git(root, 'gc', '--prune=now', '--quiet');

    const next = await reader.listCommits({
      limit: 3,
      ...(first.nextAfter && first.tip
        ? { after: first.nextAfter, tip: first.tip }
        : {}),
    });
    expect(next.restarted).toBe(true);
    expect(subjects(next)[0]).toBe('commit 4');
  });

  /**
   * Decoration is display configuration. Reading HEAD from it let a repository
   * that excludes `refs/heads/*` turn an attached branch into a detached one.
   */
  it('reads HEAD and refs despite repository decoration settings', async () => {
    const { root, reader } = await repository(1);
    git(root, 'tag', 'v1');
    git(root, 'config', 'log.excludeDecoration', 'refs/heads/*');
    const page = await reader.listCommits({});
    expect(page.snapshot?.head).toEqual({
      kind: 'attached',
      ref: 'refs/heads/main',
    });
    expect(page.commits[0]?.refs).toEqual(
      expect.arrayContaining(['main', 'v1']),
    );
  });

  /**
   * A linked worktree is the case that matters: its administrative and common
   * directories live inside the main repository, so moving its checkout aside
   * and putting another repository at that path leaves both recorded
   * directories present and unchanged. A guard that only stats what it
   * recorded sees nothing wrong while Git reads the impostor.
   */
  it('refuses to answer from a repository swapped in at the checkout path', async () => {
    const { root } = await repository(2);
    const linked = join(`${root}-linked`, 'work');
    roots.push(`${root}-linked`);
    git(root, 'worktree', 'add', linked, '-b', 'linked');
    const authorised = await checkout(linked);
    const reader = new CommitGit(authorised);
    // It answers while it is the checkout it was authorised for.
    expect((await reader.listCommits({})).commits).not.toHaveLength(0);

    const impostor = await mkdtemp(join(tmpdir(), 'porcelain-history-other-'));
    roots.push(impostor);
    git(impostor, 'init', '-b', 'main', '.');
    await writeFile(join(impostor, 'other.txt'), 'other\n');
    git(impostor, 'add', '.');
    git(impostor, 'commit', '-m', 'a different repository');
    await rename(linked, `${linked}-moved`);
    await rename(impostor, linked);
    // Both recorded directories are exactly as they were.
    expect((await stat(authorised.administrativeDirectory)).isDirectory()).toBe(
      true,
    );
    expect((await stat(authorised.commonDirectory)).isDirectory()).toBe(true);

    await expect(reader.listCommits({})).rejects.toBeInstanceOf(
      HistoryWorktreeUnavailableError,
    );
    const oid = git(linked, 'rev-parse', 'HEAD');
    await expect(reader.readCommitFiles({ oid })).rejects.toBeInstanceOf(
      HistoryWorktreeUnavailableError,
    );
    await expect(
      reader.readCommitDiffs({ oid, paths: ['other.txt'] }),
    ).rejects.toBeInstanceOf(HistoryWorktreeUnavailableError);
  });

  /**
   * More branches meet here than a continuation can name. Reporting no next
   * page would be indistinguishable from reaching the first commit, so the
   * list has to say why it stops.
   */
  it('says a history is too wide to continue rather than reporting an end', async () => {
    const { root } = await repository(1);
    const base = git(root, 'rev-parse', 'HEAD');
    const tree = git(root, 'rev-parse', 'HEAD^{tree}');
    // History width needs real commit parents, not 101 worktree checkouts.
    const heads = Array.from({ length: 101 }, (_, index) =>
      git(root, 'commit-tree', tree, '-p', base, '-m', `wide-${index}`),
    );
    const merge = git(
      root,
      'commit-tree',
      tree,
      ...heads.flatMap((head) => ['-p', head]),
      '-m',
      'octopus',
    );
    git(root, 'update-ref', 'refs/heads/main', merge);
    const reader = new CommitGit(await checkout(root));

    const page = await reader.listCommits({ limit: 1 });
    expect(subjects(page)).toEqual(['octopus']);
    expect(page.nextAfter).toBeNull();
    // Not the end of history: 102 commits are still down there.
    expect(page.boundary).toBe('wide');
  });

  /**
   * A repository that cannot be read is not a repository with no commits. The
   * pruned-anchor answer is narrow on purpose: it is about one revision Git
   * says is unknown, not about every fatal failure.
   */
  it('reports a broken repository rather than an empty branch', async () => {
    const { root, reader } = await repository(2);
    await appendFile(join(root, '.git', 'config'), '\n[core\nnot a config\n');
    await expect(reader.listCommits({})).rejects.toThrow();
  });

  it('refuses a page size or an anchor it cannot honour', async () => {
    const { reader } = await repository(1);
    await expect(reader.listCommits({ limit: 0 })).rejects.toBeInstanceOf(
      InvalidHistoryRequestError,
    );
    await expect(reader.listCommits({ limit: 101 })).rejects.toBeInstanceOf(
      InvalidHistoryRequestError,
    );
    await expect(
      reader.listCommits({ after: ['not-an-object-id'], tip: 'a'.repeat(40) }),
    ).rejects.toBeInstanceOf(InvalidHistoryRequestError);
  });

  /**
   * The runner refuses replacement objects and grafts. Without that, a
   * repository could quietly rewrite what its own history says it contains.
   */
  it('reads the real commit, not a replacement object', async () => {
    const { root, reader } = await repository(2);
    const tip = git(root, 'rev-parse', 'HEAD');
    const older = git(root, 'rev-parse', 'HEAD~1');
    git(root, 'replace', tip, older);
    const page = await reader.listCommits({});
    expect(page.commits[0]?.oid).toBe(tip);
    expect(subjects(page)).toEqual(['commit 2', 'commit 1']);
  });

  it('refuses a path that is not valid UTF-8 rather than mangling it', async () => {
    const { root, reader } = await repository(1);
    // Git can carry malformed paths even on filesystems that reject them.
    const blob = git(root, 'rev-parse', 'HEAD:file.txt');
    execFileSync('git', ['-C', root, 'update-index', '-z', '--index-info'], {
      input: Buffer.concat([
        Buffer.from(`100644 ${blob}\t`),
        Buffer.from([0xff]),
        Buffer.from('.txt\0'),
      ]),
    });
    git(root, 'commit', '-m', 'odd name');
    const oid = git(root, 'rev-parse', 'HEAD');
    await expect(reader.readCommitFiles({ oid })).rejects.toBeInstanceOf(
      UnsupportedHistoryDataError,
    );
  });

  it('reads a repository whose object ids are SHA-256', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-history-sha256-'));
    roots.push(root);
    git(root, 'init', '--object-format=sha256', '-b', 'main', '.');
    await writeFile(join(root, 'file.txt'), 'one\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'only commit');
    const reader = new CommitGit(await checkout(root));
    const page = await reader.listCommits({});
    expect(page.commits[0]?.oid).toHaveLength(64);
    expect(subjects(page)).toEqual(['only commit']);
  });

  it('marks the end of a shallow history as a boundary', async () => {
    const { root } = await repository(5);
    const clone = await mkdtemp(join(tmpdir(), 'porcelain-history-shallow-'));
    roots.push(clone);
    execFileSync(
      'git',
      ['clone', '--depth=2', `file://${root}`, join(clone, 'checkout')],
      {
        env: {
          ...process.env,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: devNull,
        },
        stdio: 'ignore',
      },
    );
    const reader = new CommitGit(await checkout(join(clone, 'checkout')));
    const page = await reader.listCommits({});
    expect(page.commits).toHaveLength(2);
    expect(page.boundary).toBe('shallow');
  });

  it('refuses a worktree that is no longer the one it resolved', async () => {
    const { root } = await repository(1);
    const stale = await checkout(root);
    const reader = new CommitGit({ ...stale, repositoryIdentity: 'moved' });
    await expect(reader.listCommits({})).rejects.toBeInstanceOf(
      HistoryWorktreeUnavailableError,
    );
  });

  describe('opening a commit', () => {
    async function history() {
      const { root } = await repository();
      await writeFile(join(root, 'a.txt'), 'one\n');
      git(root, 'add', '.');
      git(root, 'commit', '-m', 'root commit');
      git(root, 'checkout', '-b', 'side');
      await writeFile(join(root, 'side.txt'), 'side\n');
      git(root, 'add', '.');
      git(root, 'commit', '-m', 'side work');
      git(root, 'checkout', 'main');
      git(root, 'mv', 'a.txt', 'b.txt');
      git(root, 'commit', '-m', 'rename it');
      git(root, 'merge', '--no-ff', 'side', '-m', 'merge side');
      return { root, reader: new CommitGit(await checkout(root)) };
    }

    it('lists what a first commit added, comparing against nothing', async () => {
      const { root, reader } = await history();
      const oid = git(root, 'rev-list', '--max-parents=0', 'HEAD');
      const result = await reader.readCommitFiles({ oid });
      expect(result.comparison).toEqual({ kind: 'empty-tree' });
      expect(result.files).toEqual([
        {
          oldPath: null,
          newPath: 'a.txt',
          status: 'added',
          oldMode: '000000',
          newMode: '100644',
        },
      ]);
    });

    it('names both sides of a rename', async () => {
      const { root, reader } = await history();
      const oid = git(root, 'rev-parse', 'HEAD^1');
      const result = await reader.readCommitFiles({ oid });
      expect(result.files).toEqual([
        expect.objectContaining({
          oldPath: 'a.txt',
          newPath: 'b.txt',
          status: 'renamed',
        }),
      ]);
    });

    /**
     * A merge prints no file list at all unless Git is told which side to
     * compare with, so this is the case that would silently open empty.
     */
    it('shows a merge against its first parent, and against another on request', async () => {
      const { root, reader } = await history();
      const oid = git(root, 'rev-parse', 'HEAD');
      const first = await reader.readCommitFiles({ oid });
      expect(first.files.map((file) => file.newPath)).toEqual(['side.txt']);
      expect(first.comparison).toMatchObject({
        kind: 'parent',
        parentNumber: 1,
      });
      const second = await reader.readCommitFiles({ oid, parent: 2 });
      expect(second.files.map((file) => file.newPath)).toEqual(['b.txt']);
      expect(second.comparison).toMatchObject({
        kind: 'parent',
        parentNumber: 2,
      });
    });

    it('refuses a parent the commit does not have', async () => {
      const { root, reader } = await history();
      const oid = git(root, 'rev-parse', 'HEAD^1');
      await expect(
        reader.readCommitFiles({ oid, parent: 2 }),
      ).rejects.toBeInstanceOf(InvalidHistoryRequestError);
    });

    it('reads the patches of named files, and only those', async () => {
      const { root, reader } = await history();
      const oid = git(root, 'rev-list', '--max-parents=0', 'HEAD');
      const diffs = await reader.readCommitDiffs({ oid, paths: ['a.txt'] });
      const patch = diffs?.get('a.txt');
      expect(patch).toMatchObject({ kind: 'text' });
      expect(patch && 'patch' in patch ? patch.patch : '').toContain('+one');
    });

    it('reads a rename as one diff named by both its paths', async () => {
      const { root, reader } = await history();
      const oid = git(root, 'rev-parse', 'HEAD^1');
      const diffs = await reader.readCommitDiffs({
        oid,
        paths: ['a.txt', 'b.txt'],
      });
      expect(diffs?.get('a.txt\0b.txt')).toMatchObject({
        kind: 'metadata-only',
      });
    });

    it('refuses a request naming no file at all', async () => {
      const { root, reader } = await history();
      const oid = git(root, 'rev-parse', 'HEAD');
      await expect(
        reader.readCommitDiffs({ oid, paths: [] }),
      ).rejects.toBeInstanceOf(InvalidHistoryRequestError);
    });
  });
});
