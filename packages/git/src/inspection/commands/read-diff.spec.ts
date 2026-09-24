import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readCommitDiffs, readDiff, readDiffs } from './read-diff.ts';

type Change = Parameters<typeof readDiff>[1];

let checkout: string;

const git = (...args: string[]) =>
  execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();

const write = (path: string, content: string | Buffer) =>
  writeFileSync(join(checkout, path), content);

const short = (revision: string) => git('rev-parse', '--short=7', revision);

const session = (): Parameters<typeof readDiff>[0] => ({
  path: checkout,
  verify: () => Promise.resolve(),
  confirm: () => Promise.resolve(),
  conversionFilters: (read) => read(),
});

const change = (
  scope: Change['scope'],
  path: string,
  overrides: Partial<Change> = {},
): Change => ({
  scope,
  kind: 'modified',
  oldPath: path,
  newPath: path,
  oldMode: '100644',
  newMode: '100644',
  oldOid: null,
  newOid: null,
  supported: true,
  ...overrides,
});

const commit = (message: string) => {
  git('add', '--all');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
};

const modifiedPatch = (path: string, from: string, to: string) =>
  `diff --git a/${path} b/${path}\nindex ${from}..${to} 100644\n--- a/${path}\n+++ b/${path}\n`;

beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'porcelain-read-diff-'));
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
  git('config', 'user.name', 'T');
  git('config', 'user.email', 't@e');
  write('a.txt', 'one\ntwo\nthree\n');
  commit('base');
});

afterEach(() => {
  rmSync(checkout, { recursive: true, force: true });
});

describe('readDiff', () => {
  it('reads the unstaged patch of a modified file', async () => {
    write('a.txt', 'one\nTWO\nthree\n');
    expect(await readDiff(session(), change('unstaged', 'a.txt'))).toEqual({
      kind: 'text',
      patch: `${modifiedPatch('a.txt', short('HEAD:a.txt'), git('hash-object', 'a.txt').slice(0, 7))}@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n three\n`,
    });
  });

  it('reads the staged patch from the index rather than the working tree', async () => {
    write('a.txt', 'one\nTWO\nthree\n');
    git('add', 'a.txt');
    write('a.txt', 'one\nTHREE\nthree\n');
    expect(await readDiff(session(), change('staged', 'a.txt'))).toEqual({
      kind: 'text',
      patch: `${modifiedPatch('a.txt', short('HEAD:a.txt'), short(':a.txt'))}@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n three\n`,
    });
  });

  it("ignores the repository's own prefix, colour, context, external diff and textconv settings", async () => {
    git('config', 'diff.noprefix', 'true');
    git('config', 'color.diff', 'always');
    git('config', 'diff.context', '0');
    git('config', 'diff.external', 'false');
    git('config', 'diff.shout.textconv', 'tr a-z A-Z');
    writeFileSync(
      join(checkout, '.git', 'info', 'attributes'),
      '*.txt diff=shout\n',
    );
    write('a.txt', 'one\nTWO\nthree\n');
    expect(await readDiff(session(), change('unstaged', 'a.txt'))).toEqual({
      kind: 'text',
      patch: `${modifiedPatch('a.txt', short('HEAD:a.txt'), git('hash-object', 'a.txt').slice(0, 7))}@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n three\n`,
    });
  });

  it('reports a binary change without a patch', async () => {
    write('a.txt', Buffer.from([0, 1, 2, 0]));
    expect(await readDiff(session(), change('unstaged', 'a.txt'))).toEqual({
      kind: 'binary',
    });
  });

  it('reports a mode change as metadata with the patch Git prints for it', async () => {
    chmodSync(join(checkout, 'a.txt'), 0o755);
    expect(
      await readDiff(
        session(),
        change('unstaged', 'a.txt', { newMode: '100755' }),
      ),
    ).toEqual({
      kind: 'metadata-only',
      patch: 'diff --git a/a.txt b/a.txt\nold mode 100644\nnew mode 100755\n',
    });
  });

  it('finds a staged rename under both of its paths', async () => {
    git('mv', 'a.txt', 'b.txt');
    expect(
      await readDiff(
        session(),
        change('staged', 'b.txt', { kind: 'renamed', oldPath: 'a.txt' }),
      ),
    ).toEqual({
      kind: 'metadata-only',
      patch:
        'diff --git a/a.txt b/b.txt\nsimilarity index 100%\nrename from a.txt\nrename to b.txt\n',
    });
  });

  it('returns an empty metadata patch when the file no longer differs', async () => {
    expect(await readDiff(session(), change('unstaged', 'a.txt'))).toEqual({
      kind: 'metadata-only',
      patch: '',
    });
  });

  it('omits a submodule change it cannot inspect', async () => {
    expect(
      await readDiff(
        session(),
        change('unstaged', 'vendor', {
          oldMode: '160000',
          newMode: '160000',
          supported: false,
        }),
      ),
    ).toEqual({ kind: 'omitted', reason: 'unsupported-submodule' });
  });

  it('omits the diff when the output passes the batch size limit', async () => {
    write(
      'large.txt',
      'x'
        .repeat(1023)
        .concat('\n')
        .repeat(33 * 1024),
    );
    git('add', 'large.txt');
    expect(
      await readDiff(
        session(),
        change('staged', 'large.txt', { kind: 'added', oldPath: null }),
      ),
    ).toEqual({ kind: 'omitted', reason: 'size-limit' });
  });

  it('refuses an unstaged diff when a tracked path uses a conversion filter', async () => {
    write('.gitattributes', 'a.txt filter=secret\n');
    commit('filter');
    write('a.txt', 'one\nTWO\nthree\n');
    await expect(
      readDiff(session(), change('unstaged', 'a.txt')),
    ).rejects.toMatchObject({ name: 'UnsupportedGitFiltersError' });
  });

  it('reads a staged diff even when a tracked path uses a conversion filter', async () => {
    write('.gitattributes', 'a.txt filter=secret\n');
    commit('filter');
    write('a.txt', 'one\nTWO\nthree\n');
    git('add', 'a.txt');
    expect(await readDiff(session(), change('staged', 'a.txt'))).toMatchObject({
      kind: 'text',
    });
  });
});

describe('readDiffs', () => {
  it('returns each change in the order asked, keeping the staged and unstaged patches of one file apart', async () => {
    write('a.txt', 'one\nTWO\nthree\n');
    git('add', 'a.txt');
    write('a.txt', 'one\nTHREE\nthree\n');
    const staged = short(':a.txt');
    const worktree = git('hash-object', 'a.txt').slice(0, 7);
    expect(
      await readDiffs(session(), [
        change('unstaged', 'a.txt'),
        change('staged', 'a.txt'),
      ]),
    ).toEqual([
      {
        kind: 'text',
        patch: `${modifiedPatch('a.txt', staged, worktree)}@@ -1,3 +1,3 @@\n one\n-TWO\n+THREE\n three\n`,
      },
      {
        kind: 'text',
        patch: `${modifiedPatch('a.txt', short('HEAD:a.txt'), staged)}@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n three\n`,
      },
    ]);
  });
});

describe('readCommitDiffs', () => {
  it('reads the paths asked for from a commit against its first parent', async () => {
    write('a.txt', 'one\nTWO\nthree\n');
    write('b.txt', 'bee\n');
    const oid = commit('second');
    expect(await readCommitDiffs(checkout, oid, 1, ['a.txt'])).toEqual(
      new Map([
        [
          'a.txt',
          {
            kind: 'text',
            patch: `${modifiedPatch('a.txt', short(`${oid}^:a.txt`), short(`${oid}:a.txt`))}@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n three\n`,
          },
        ],
      ]),
    );
  });

  it('reads the root commit as adding its files', async () => {
    const root = git('rev-list', '--max-parents=0', 'HEAD');
    expect(await readCommitDiffs(checkout, root, 1, ['a.txt'])).toEqual(
      new Map([
        [
          'a.txt',
          {
            kind: 'text',
            patch: `diff --git a/a.txt b/a.txt\nnew file mode 100644\nindex 0000000..${short(`${root}:a.txt`)}\n--- /dev/null\n+++ b/a.txt\n@@ -0,0 +1,3 @@\n+one\n+two\n+three\n`,
          },
        ],
      ]),
    );
  });

  it.each([
    { parent: 1, side: 'the first parent', paths: ['b.txt'] },
    { parent: 2, side: 'the second parent', paths: ['a.txt'] },
  ])(
    'reads a merge against $side when asked for it',
    async ({ parent, paths }) => {
      git('switch', '-q', '-c', 'side');
      write('b.txt', 'bee\n');
      commit('side');
      git('switch', '-q', 'main');
      write('a.txt', 'one\nTWO\nthree\n');
      commit('main');
      git('merge', '-q', '--no-edit', 'side');
      const merge = git('rev-parse', 'HEAD');
      expect([
        ...(
          (await readCommitDiffs(checkout, merge, parent, [
            'a.txt',
            'b.txt',
          ])) ?? new Map()
        ).keys(),
      ]).toEqual(paths);
    },
  );
});
