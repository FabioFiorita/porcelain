import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { devNull, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommitCursorCodec } from './commit-cursor.ts';
import { CommitGit } from './commit-git.ts';
import type { CommitPage, HistoryCheckout } from './dtos/commit-history.ts';
import { HistorySnapshotUnavailableError } from './errors/history-snapshot-unavailable-error.ts';
import { HistoryWorktreeUnavailableError } from './errors/history-worktree-unavailable-error.ts';
import { InvalidHistoryRequestError } from './errors/invalid-history-request-error.ts';
import { ReadLimitExceededError } from './errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from './errors/unsupported-history-data-error.ts';
import { Git } from './git.ts';

describe('CommitGit', () => {
  const roots: string[] = [];
  afterEach(async () => {
    vi.unstubAllEnvs();
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
  async function reader(
    path: string,
    scope = 'fixture',
  ): Promise<{
    adapter: CommitGit;
    checkout: HistoryCheckout;
    codec: CommitCursorCodec;
  }> {
    const { repository } = await new Git(path).listWorktrees();
    const worktree = repository.worktrees.find((entry) => entry.path === path);
    if (!worktree?.metadataIdentity)
      throw new Error('Missing fixture identity');
    const checkout = {
      path,
      repositoryIdentity: repository.repositoryIdentity,
      metadataIdentity: worktree.metadataIdentity,
      scope,
    };
    const codec = new CommitCursorCodec(randomBytes(32));
    return { adapter: new CommitGit(checkout, codec), checkout, codec };
  }
  async function fixture(format = 'sha1') {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), 'porcelain-history-')),
    );
    roots.push(root);
    const path = join(root, 'repo');
    await mkdir(path);
    git(path, 'init', '-b', 'main', `--object-format=${format}`);
    return { root, path, ...(await reader(path)) };
  }
  async function commit(
    path: string,
    name: string,
    text = name,
  ): Promise<string> {
    await writeFile(join(path, name), text);
    git(path, 'add', '--', name);
    git(path, '-c', 'commit.gpgsign=false', 'commit', '-m', name);
    return git(path, 'rev-parse', 'HEAD');
  }
  async function remaining(
    adapter: CommitGit,
    first: CommitPage,
  ): Promise<string[]> {
    const oids = first.commits.map((entry) => entry.oid);
    let cursor = first.nextCursor;
    while (cursor) {
      const page = await adapter.listCommits({ cursor });
      oids.push(...page.commits.map((entry) => entry.oid));
      cursor = page.nextCursor;
    }
    return oids;
  }

  describe('History traversal and pagination', () => {
    it('keeps all ancestors in topological order across ref movement, reset and deletion', async () => {
      const f = await fixture();
      const root = await commit(f.path, 'root');
      git(f.path, 'checkout', '-b', 'side');
      const side = await commit(f.path, 'side');
      git(f.path, 'checkout', 'main');
      const main = await commit(f.path, 'main');
      git(
        f.path,
        '-c',
        'commit.gpgsign=false',
        'merge',
        '--no-ff',
        'side',
        '-m',
        'merge',
      );
      const tip = git(f.path, 'rev-parse', 'HEAD');
      const first = await f.adapter.listCommits({ limit: 1 });
      await commit(f.path, 'later');
      git(f.path, 'reset', '--hard', root);
      git(f.path, 'checkout', '--detach');
      git(f.path, 'branch', '-D', 'main');
      const oids = await remaining(f.adapter, first);
      expect(first.snapshot).toEqual({
        tipOid: tip,
        head: { kind: 'attached', ref: 'refs/heads/main' },
      });
      expect(oids[0]).toBe(tip);
      expect(oids.at(-1)).toBe(root);
      expect(new Set(oids)).toEqual(new Set([tip, side, main, root]));
      expect(oids).toHaveLength(4);
      expect(oids).toEqual(
        git(f.path, 'rev-list', '--topo-order', tip).split('\n'),
      );
    });

    it('rejects tampered, cross-worktree and restarted cursors and honors a cursor page size', async () => {
      const f = await fixture();
      await commit(f.path, 'one');
      await commit(f.path, 'two');
      const first = await f.adapter.listCommits({ limit: 1 });
      const cursor = first.nextCursor;
      if (!cursor) throw new Error('Missing cursor');
      await expect(
        f.adapter.listCommits({ cursor: `x${cursor}` }),
      ).rejects.toBeInstanceOf(InvalidHistoryRequestError);
      await expect(
        f.adapter.listCommits({ cursor, limit: 2 }),
      ).rejects.toBeInstanceOf(InvalidHistoryRequestError);
      await expect(
        new CommitGit(
          { ...f.checkout, scope: 'another-worktree' },
          f.codec,
        ).listCommits({ cursor }),
      ).rejects.toBeInstanceOf(InvalidHistoryRequestError);
      await expect(
        new CommitGit(
          f.checkout,
          new CommitCursorCodec(randomBytes(32)),
        ).listCommits({ cursor }),
      ).rejects.toBeInstanceOf(InvalidHistoryRequestError);
      expect((await f.adapter.listCommits({ cursor })).commits).toHaveLength(1);
    });

    it('marks shallow history and rejects continuation after deepening without treating a boundary as a root', async () => {
      const f = await fixture();
      await commit(f.path, 'one');
      await commit(f.path, 'two');
      await commit(f.path, 'three');
      const path = join(f.root, 'shallow');
      git(f.path, 'clone', '--depth=2', `file://${f.path}`, path);
      const { adapter } = await reader(path);
      const first = await adapter.listCommits({ limit: 1 });
      if (!first.nextCursor) throw new Error('Missing cursor');
      const last = await adapter.listCommits({ cursor: first.nextCursor });
      expect(last.boundary).toBe('shallow');
      const boundary = last.commits[0];
      if (!boundary) throw new Error('Missing boundary');
      await expect(
        adapter.inspectCommitChanges({ oid: boundary.oid }),
      ).rejects.toBeInstanceOf(HistorySnapshotUnavailableError);
      git(path, 'fetch', '--unshallow');
      await expect(
        adapter.listCommits({ cursor: first.nextCursor }),
      ).rejects.toBeInstanceOf(HistorySnapshotUnavailableError);
    });
  });
  describe('Commit comparisons', () => {
    it('distinguishes unborn and detached HEAD and SHA-256 root inspection', async () => {
      const f = await fixture('sha256');
      expect(await f.adapter.listCommits({})).toEqual({
        snapshot: {
          tipOid: null,
          head: { kind: 'unborn', ref: 'refs/heads/main' },
        },
        commits: [],
        nextCursor: null,
        boundary: null,
      });
      const oid = await commit(f.path, 'root', 'hello\n');
      git(f.path, 'checkout', '--detach');
      expect((await f.adapter.listCommits({})).snapshot).toEqual({
        tipOid: oid,
        head: { kind: 'detached' },
      });
      const inspection = await f.adapter.inspectCommitChanges({ oid });
      expect(oid).toHaveLength(64);
      expect(inspection.comparison).toEqual({ kind: 'empty-tree' });
      expect(inspection.changes).toMatchObject([
        {
          oldPath: null,
          newPath: 'root',
          status: 'added',
          patch: { kind: 'text', text: expect.stringContaining('+hello') },
        },
      ]);
      await expect(
        f.adapter.inspectCommitChanges({ oid, parent: 1 }),
      ).rejects.toBeInstanceOf(InvalidHistoryRequestError);
    });

    it('compares merge commits against the chosen parent and handles empty commits', async () => {
      const f = await fixture();
      await commit(f.path, 'root');
      git(f.path, 'checkout', '-b', 'side');
      const side = await commit(f.path, 'side');
      git(f.path, 'checkout', 'main');
      const main = await commit(f.path, 'main');
      git(
        f.path,
        '-c',
        'commit.gpgsign=false',
        'merge',
        '--no-ff',
        'side',
        '-m',
        'merge',
      );
      const oid = git(f.path, 'rev-parse', 'HEAD');
      const first = await f.adapter.inspectCommitChanges({ oid });
      expect(first.comparison).toEqual({
        kind: 'parent',
        parentNumber: 1,
        baseOid: main,
      });
      expect(first.changes.map((entry) => entry.newPath)).toEqual(['side']);
      const second = await f.adapter.inspectCommitChanges({ oid, parent: 2 });
      expect(second.comparison).toEqual({
        kind: 'parent',
        parentNumber: 2,
        baseOid: side,
      });
      expect(second.changes.map((entry) => entry.newPath)).toEqual(['main']);
      await expect(
        f.adapter.inspectCommitChanges({ oid, parent: 3 }),
      ).rejects.toBeInstanceOf(InvalidHistoryRequestError);
      git(
        f.path,
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--allow-empty',
        '-m',
        'empty',
      );
      expect(
        (
          await f.adapter.inspectCommitChanges({
            oid: git(f.path, 'rev-parse', 'HEAD'),
          })
        ).changes,
      ).toEqual([]);
    });

    it('detects renames at 50 percent, retains literal unusual paths, and distinguishes binary and modes without modifying the checkout', async () => {
      const f = await fixture();
      const odd = '-old\n\t😀';
      await commit(f.path, odd, 'one\ntwo\nthree\nfour\n');
      git(f.path, 'mv', '--', odd, 'renamed');
      await writeFile(join(f.path, 'renamed'), 'one\ntwo\nthree\nchanged\n');
      await writeFile(join(f.path, 'binary'), Buffer.from([0, 1, 2]));
      await symlink('renamed', join(f.path, 'link'));
      git(f.path, 'add', '.');
      git(f.path, '-c', 'commit.gpgsign=false', 'commit', '-m', 'changes');
      const oid = git(f.path, 'rev-parse', 'HEAD');
      await writeFile(join(f.path, 'untracked'), 'leave me');
      const beforeIndex = await readFile(join(f.path, '.git/index'));
      const beforeRefs = git(f.path, 'show-ref');
      const result = await f.adapter.inspectCommitChanges({ oid });
      expect(result.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'renamed',
            oldPath: odd,
            newPath: 'renamed',
          }),
          expect.objectContaining({
            newPath: 'binary',
            patch: { kind: 'binary' },
          }),
          expect.objectContaining({ newPath: 'link', newMode: '120000' }),
        ]),
      );
      expect(await readFile(join(f.path, '.git/index'))).toEqual(beforeIndex);
      expect(git(f.path, 'show-ref')).toBe(beforeRefs);
      expect(await readFile(join(f.path, 'untracked'), 'utf8')).toBe(
        'leave me',
      );
    });

    it('supports octopus parent selection and reports gitlinks, mode changes and copies without recursion', async () => {
      const f = await fixture();
      const root = await commit(f.path, 'root');
      git(f.path, 'checkout', '-b', 'one');
      await commit(f.path, 'one');
      git(f.path, 'checkout', '-b', 'two', root);
      const two = await commit(f.path, 'two');
      git(f.path, 'checkout', 'main');
      await commit(f.path, 'main');
      git(
        f.path,
        '-c',
        'commit.gpgsign=false',
        'merge',
        'one',
        'two',
        '-m',
        'octopus',
      );
      const merge = git(f.path, 'rev-parse', 'HEAD');
      const comparison = await f.adapter.inspectCommitChanges({
        oid: merge,
        parent: 3,
      });
      expect(comparison.parentOids).toHaveLength(3);
      expect(comparison.comparison).toEqual({
        kind: 'parent',
        parentNumber: 3,
        baseOid: two,
      });
      expect(comparison.changes.map((change) => change.newPath)).toEqual([
        'main',
        'one',
      ]);
      git(
        f.path,
        'update-index',
        '--add',
        '--cacheinfo',
        `160000,${root},module`,
      );
      git(f.path, 'update-index', '--chmod=+x', 'root');
      await writeFile(join(f.path, 'copy'), 'root');
      git(f.path, 'add', 'copy');
      git(
        f.path,
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-m',
        'gitlink and mode',
      );
      git(f.path, 'config', 'diff.renames', 'copies');
      const changes = (
        await f.adapter.inspectCommitChanges({
          oid: git(f.path, 'rev-parse', 'HEAD'),
        })
      ).changes;
      expect(changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            newPath: 'module',
            newMode: '160000',
            patch: { kind: 'submodule', text: expect.stringContaining(root) },
          }),
          expect.objectContaining({
            newPath: 'root',
            oldMode: '100644',
            newMode: '100755',
          }),
          expect.objectContaining({
            newPath: 'copy',
            status: 'added',
            oldPath: null,
          }),
        ]),
      );
    });
  });
  describe('Inspection limits and isolation', () => {
    it('truncates multibyte subjects at a valid UTF-8 boundary and rejects oversized change results', async () => {
      const f = await fixture();
      await commit(f.path, 'root');
      git(
        f.path,
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--allow-empty',
        '-m',
        '😀'.repeat(129),
      );
      const page = await f.adapter.listCommits({ limit: 1 });
      expect(page.commits[0]?.subject).toBe('😀'.repeat(128));
      expect(page.commits[0]?.subjectTruncated).toBe(true);
      git(
        f.path,
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--allow-empty',
        '-m',
        `${'a'.repeat(511)}😀`,
      );
      const splitCharacter = await f.adapter.listCommits({ limit: 1 });
      expect(splitCharacter.commits[0]?.subject).toBe('a'.repeat(511));
      expect(splitCharacter.commits[0]?.subjectTruncated).toBe(true);
      const oid = await commit(f.path, 'large', 'a'.repeat(1024 * 1024));
      await expect(
        f.adapter.inspectCommitChanges({ oid }),
      ).rejects.toBeInstanceOf(ReadLimitExceededError);
      for (let i = 0; i < 501; i++)
        await writeFile(join(f.path, `file-${i}`), 'x');
      git(f.path, 'add', '.');
      git(f.path, '-c', 'commit.gpgsign=false', 'commit', '-m', 'many');
      await expect(
        f.adapter.inspectCommitChanges({
          oid: git(f.path, 'rev-parse', 'HEAD'),
        }),
      ).rejects.toBeInstanceOf(ReadLimitExceededError);
    });

    it('rejects replacement checkout identities, missing snapshot objects and non-UTF-8 paths', async () => {
      const f = await fixture();
      const root = await commit(f.path, 'root');
      const tip = await commit(f.path, 'tip');
      const first = await f.adapter.listCommits({ limit: 1 });
      if (!first.nextCursor) throw new Error('Missing cursor');
      await rm(join(f.path, '.git/objects', tip.slice(0, 2), tip.slice(2)));
      await expect(
        f.adapter.listCommits({ cursor: first.nextCursor }),
      ).rejects.toBeInstanceOf(HistorySnapshotUnavailableError);
      git(f.path, 'update-ref', 'refs/heads/main', root);
      const blob = git(f.path, 'hash-object', '-w', 'root');
      const tree = execFileSync('git', ['-C', f.path, 'mktree', '-z'], {
        input: Buffer.concat([
          Buffer.from(`100644 blob ${blob}\t`),
          Buffer.from([0xff, 0]),
        ]),
        encoding: 'utf8',
      }).trim();
      const invalidCommit = git(
        f.path,
        'commit-tree',
        tree,
        '-p',
        root,
        '-m',
        'invalid path',
      );
      await expect(
        f.adapter.inspectCommitChanges({ oid: invalidCommit }),
      ).rejects.toBeInstanceOf(UnsupportedHistoryDataError);
      await rename(f.path, join(f.root, 'old'));
      await mkdir(f.path);
      git(f.path, 'init', '-b', 'main');
      await expect(f.adapter.listCommits({})).rejects.toBeInstanceOf(
        HistoryWorktreeUnavailableError,
      );
    });

    it('ignores replacement objects and configured external diff and textconv programs', async () => {
      const f = await fixture();
      const root = await commit(f.path, 'file', 'original');
      const replacement = await commit(f.path, 'other', 'other');
      git(f.path, 'replace', root, replacement);
      git(f.path, 'config', 'diff.external', 'touch SHOULD-NOT-EXIST');
      git(f.path, 'config', 'diff.fixture.textconv', 'touch SHOULD-NOT-EXIST');
      await writeFile(join(f.path, '.gitattributes'), '* diff=fixture\n');
      const inspection = await f.adapter.inspectCommitChanges({ oid: root });
      expect(inspection.comparison).toEqual({ kind: 'empty-tree' });
      expect(inspection.changes.map((entry) => entry.newPath)).toEqual([
        'file',
      ]);
      await expect(
        readFile(join(f.path, 'SHOULD-NOT-EXIST')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      const controller = new AbortController();
      controller.abort();
      await expect(
        f.adapter.listCommits({}, controller.signal),
      ).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('does not lazily fetch promised blobs during commit inspection', async () => {
      const f = await fixture();
      const oid = await commit(f.path, 'root', 'promised content');
      git(f.path, 'config', 'uploadpack.allowFilter', 'true');
      const path = join(f.root, 'partial');
      git(
        f.path,
        'clone',
        '--filter=blob:none',
        '--no-checkout',
        `file://${f.path}`,
        path,
      );
      const { adapter } = await reader(path);
      const missing = git(
        path,
        'rev-list',
        '--objects',
        '--missing=print',
        'HEAD',
      );
      expect(missing).toContain('?');
      // An attempted lazy fetch would fail locally and leave evidence, without network access.
      const marker = join(f.root, 'fetch-attempted');
      git(
        path,
        'config',
        'remote.origin.uploadpack',
        `touch '${marker}'; false`,
      );
      await expect(
        adapter.inspectCommitChanges({ oid }),
      ).rejects.toBeInstanceOf(HistorySnapshotUnavailableError);
      expect(
        git(path, 'rev-list', '--objects', '--missing=print', 'HEAD'),
      ).toBe(missing);
      await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it.each(['file-to-symlink', 'symlink-to-file'] as const)(
      'preserves both patch sections for %s changes without shifting neighboring patches',
      async (direction) => {
        const f = await fixture();
        await writeFile(join(f.path, 'a-before'), 'before old\n');
        if (direction === 'file-to-symlink')
          await writeFile(join(f.path, 'middle'), 'regular content\n');
        else await symlink('target', join(f.path, 'middle'));
        await writeFile(join(f.path, 'z-after'), 'after old\n');
        git(f.path, 'add', '.');
        git(
          f.path,
          '-c',
          'commit.gpgsign=false',
          'commit',
          '-m',
          'initial types',
        );
        await rm(join(f.path, 'middle'));
        if (direction === 'file-to-symlink')
          await symlink('target', join(f.path, 'middle'));
        else await writeFile(join(f.path, 'middle'), 'regular content\n');
        await writeFile(join(f.path, 'a-before'), 'before new\n');
        await writeFile(join(f.path, 'z-after'), 'after new\n');
        git(f.path, 'add', '.');
        git(
          f.path,
          '-c',
          'commit.gpgsign=false',
          'commit',
          '-m',
          'change types',
        );
        const result = await f.adapter.inspectCommitChanges({
          oid: git(f.path, 'rev-parse', 'HEAD'),
        });
        expect(result.changes.map((change) => change.newPath)).toEqual([
          'a-before',
          'middle',
          'z-after',
        ]);
        const middle = result.changes[1];
        expect(middle).toMatchObject({
          status: 'type-changed',
          oldPath: 'middle',
          newPath: 'middle',
          oldMode: direction === 'file-to-symlink' ? '100644' : '120000',
          newMode: direction === 'file-to-symlink' ? '120000' : '100644',
        });
        if (middle?.patch.kind !== 'text')
          throw new Error('Expected text patch');
        expect(middle.patch.text).toContain(
          direction === 'file-to-symlink'
            ? '-regular content'
            : '+regular content',
        );
        expect(middle.patch.text).toContain(
          direction === 'file-to-symlink' ? '+target' : '-target',
        );
        expect(middle.patch.text.match(/^diff --git /gm)).toHaveLength(2);
        expect(result.changes[0]?.patch).toEqual({
          kind: 'text',
          text: expect.stringContaining('+before new'),
        });
        expect(result.changes[2]?.patch).toEqual({
          kind: 'text',
          text: expect.stringContaining('+after new'),
        });
      },
    );
  });
});
