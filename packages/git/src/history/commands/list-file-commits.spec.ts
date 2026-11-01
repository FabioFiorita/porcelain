import { Effect } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';
import { listFileCommits as listFileCommitsEffect } from './list-file-commits.ts';

const listFileCommits = (...args: Parameters<typeof listFileCommitsEffect>) =>
  Effect.runPromise(
    listFileCommitsEffect(...args).pipe(Effect.provide(NodeServices.layer)),
  );

let checkout: string;

const git = (...args: string[]) =>
  execFileSync(
    'git',
    ['-C', checkout, '-c', 'user.name=T', '-c', 'user.email=t@e', ...args],
    { encoding: 'utf8' },
  ).trim();

const write = (path: string, content: string) => {
  mkdirSync(join(checkout, path, '..'), { recursive: true });
  writeFileSync(join(checkout, path), content);
};

const commitAll = (message: string) => {
  git('add', '-A');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
};

const identityOf = (path: string) => {
  const info = statSync(path, { bigint: true });
  return `${info.ino}:${info.birthtimeNs}`;
};

const historyCheckout = () => {
  const gitDirectory = join(checkout, '.git');
  return {
    path: checkout,
    commonDirectory: gitDirectory,
    administrativeDirectory: gitDirectory,
    repositoryIdentity: identityOf(gitDirectory),
    metadataIdentity: identityOf(gitDirectory),
  };
};

type FileCommitsRequest = Parameters<typeof listFileCommits>[2];

const version = Buffer.from('git version');
const list = (request: FileCommitsRequest) =>
  listFileCommits(historyCheckout(), version, request, gitLimits);
const subjects = async (request: FileCommitsRequest) =>
  (await list(request)).commits.map((entry) => entry.commit.subject);

function renamedFile() {
  write('notes.txt', 'one\ntwo\nthree\nfour\n');
  commitAll('add notes');
  write('other.txt', 'other\n');
  commitAll('touch other');
  mkdirSync(join(checkout, 'docs'));
  git('mv', 'notes.txt', 'docs/notes.md');
  commitAll('move notes');
  write('docs/notes.md', 'one\ntwo\nthree\nfour\nfive\n');
  return commitAll('extend notes');
}

beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'porcelain-file-commits-'));
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
});

afterEach(() => {
  rmSync(checkout, { recursive: true, force: true });
});

describe('listFileCommits', () => {
  it('reports the real start of a file created after a shallow boundary', async () => {
    write('older.txt', 'Older content\n');
    const boundary = commitAll('shallow boundary');
    write('notes.txt', 'Created after the boundary\n');
    commitAll('create newer notes');
    write('notes.txt', 'Newer content\n');
    commitAll('extend newer notes');
    writeFileSync(join(checkout, '.git', 'shallow'), `${boundary}\n`);
    const page = await list({ path: 'notes.txt' });
    expect(page.commits.map((entry) => entry.commit.subject)).toEqual([
      'extend newer notes',
      'create newer notes',
    ]);
    expect(page.nextAfter).toBeNull();
    expect(page.boundary).toBeNull();
  });

  it('reports a shallow boundary instead of claiming the start of a file history', async () => {
    const tip = renamedFile();
    writeFileSync(join(checkout, '.git', 'shallow'), `${tip}\n`);
    const page = await list({ path: 'docs/notes.md' });
    expect(page.commits.map((entry) => entry.commit.subject)).toEqual([
      'extend notes',
    ]);
    expect(page.nextAfter).toBeNull();
    expect(page.boundary).toBe('shallow');
  });

  it('continues across a rename at a page boundary without repeating or losing historical paths', async () => {
    const tip = renamedFile();
    const first = await list({ path: 'docs/notes.md', limit: 2 });
    expect(first.nextAfter).toEqual({ tip, offset: 2 });
    const second = await list({
      path: 'docs/notes.md',
      limit: 2,
      after: first.nextAfter!,
    });
    expect(
      [...first.commits, ...second.commits].map((entry) => [
        entry.commit.subject,
        entry.path,
        entry.previousPath,
        entry.status,
      ]),
    ).toEqual([
      ['extend notes', 'docs/notes.md', null, 'modified'],
      ['move notes', 'docs/notes.md', 'notes.txt', 'renamed'],
      ['add notes', 'notes.txt', null, 'added'],
    ]);
    expect(second.nextAfter).toBeNull();
    expect(second.restarted).toBe(false);
  });

  it('keeps a continuation pinned after a new commit and restarts after unrelated history replaces it', async () => {
    const tip = renamedFile();
    const first = await list({ path: 'docs/notes.md', limit: 1 });
    expect(first.nextAfter).toEqual({ tip, offset: 1 });
    write('docs/notes.md', 'newer\n');
    commitAll('newer notes');
    const older = await list({
      path: 'docs/notes.md',
      limit: 2,
      after: first.nextAfter!,
    });
    expect(older.tip).toBe(tip);
    expect(older.commits.map((entry) => entry.commit.subject)).toEqual([
      'move notes',
      'add notes',
    ]);
    git('switch', '--orphan', 'replacement');
    write('docs/notes.md', 'replacement\n');
    const replacement = commitAll('replacement root');
    const restarted = await list({
      path: 'docs/notes.md',
      limit: 2,
      after: first.nextAfter!,
    });
    expect(restarted.restarted).toBe(true);
    expect(restarted.tip).toBe(replacement);
    expect(restarted.commits.map((entry) => entry.commit.subject)).toEqual([
      'replacement root',
    ]);
    expect(restarted.nextAfter).toBeNull();
  });

  it('paginates both sides of a merge without dropping its second-parent history', async () => {
    write('notes.txt', 'one\ntwo\n');
    commitAll('add notes');
    git('switch', '-q', '-c', 'side');
    write('notes.txt', 'one\nside\n');
    commitAll('side notes');
    git('switch', '-q', 'main');
    write('notes.txt', 'one\nmain\n');
    commitAll('main notes');
    expect(() => git('merge', '-q', 'side')).toThrow();
    write('notes.txt', 'one\nmain and side\n');
    commitAll('merge side');
    const full = await list({ path: 'notes.txt' });
    expect(new Set(full.commits.map((entry) => entry.commit.subject))).toEqual(
      new Set(['merge side', 'side notes', 'main notes', 'add notes']),
    );
    const paged: typeof full.commits = [];
    let page = await list({ path: 'notes.txt', limit: 1 });
    paged.push(...page.commits);
    while (page.nextAfter !== null) {
      page = await list({ path: 'notes.txt', limit: 1, after: page.nextAfter });
      paged.push(...page.commits);
    }
    expect(paged).toEqual(full.commits);
  });

  it('lists the commits that touched the file, following it across a rename', async () => {
    renamedFile();
    const listed = await list({ path: 'docs/notes.md' });
    expect(listed.nextAfter).toBeNull();
    expect(
      listed.commits.map(({ commit, path, previousPath, status }) => ({
        subject: commit.subject,
        path,
        previousPath,
        status,
      })),
    ).toEqual([
      {
        subject: 'extend notes',
        path: 'docs/notes.md',
        previousPath: null,
        status: 'modified',
      },
      {
        subject: 'move notes',
        path: 'docs/notes.md',
        previousPath: 'notes.txt',
        status: 'renamed',
      },
      {
        subject: 'add notes',
        path: 'notes.txt',
        previousPath: null,
        status: 'added',
      },
    ]);
  });

  it('lists the newest commits up to the limit and says more exist', async () => {
    renamedFile();
    const listed = await list({ path: 'docs/notes.md', limit: 2 });
    expect(listed.commits.map((entry) => entry.commit.subject)).toEqual([
      'extend notes',
      'move notes',
    ]);
    expect(listed.nextAfter).toBeDefined();
    expect(
      (await list({ path: 'docs/notes.md', limit: 3 })).nextAfter,
    ).toBeNull();
  });

  it('counts only the commits it shows when a merge touched the file', async () => {
    write('notes.txt', 'one\ntwo\nthree\n');
    commitAll('add notes');
    git('switch', '-q', '-c', 'side');
    write('notes.txt', 'one\ntwo\nthree\nside\n');
    commitAll('side edit');
    git('switch', '-q', 'main');
    write('notes.txt', 'main\none\ntwo\nthree\n');
    commitAll('main edit');
    git('merge', '-q', '--no-edit', 'side');
    const listed = await list({ path: 'notes.txt', limit: 2 });
    expect(listed.commits).toHaveLength(2);
    expect(listed.nextAfter).toBeDefined();
  });

  it('lists the file that replaced a folder of the same name, ending where it was added', async () => {
    write('cfg/a.txt', 'a\n');
    write('cfg/b.txt', 'b\n');
    commitAll('add a cfg folder');
    git('rm', '-q', '-r', 'cfg');
    write('cfg', 'setting = 1\n');
    commitAll('replace the folder with a file');
    expect(await subjects({ path: 'cfg' })).toEqual([
      'replace the folder with a file',
    ]);
  });

  it('includes a merge whose resolution changed the file', async () => {
    write('notes.txt', 'one\ntwo\n');
    commitAll('add notes');
    git('switch', '-q', '-c', 'side');
    write('notes.txt', 'one\nside\n');
    commitAll('side notes');
    git('switch', '-q', 'main');
    write('notes.txt', 'one\nmain\n');
    commitAll('main notes');
    expect(() => git('merge', '-q', 'side')).toThrow();
    write('notes.txt', 'one\nmain and side\n');
    commitAll('merge side');
    expect((await subjects({ path: 'notes.txt' }))[0]).toBe('merge side');
  });

  it('lists nothing for a path no commit touched', async () => {
    renamedFile();
    expect(await list({ path: 'never.txt' })).toMatchObject({
      commits: [],
      nextAfter: null,
      boundary: null,
      restarted: false,
    });
  });

  it('lists nothing before the first commit', async () => {
    expect(await list({ path: 'notes.txt' })).toEqual({
      commits: [],
      nextAfter: null,
      tip: null,
      boundary: null,
      restarted: false,
    });
  });

  it('reads a path literally', async () => {
    write('*.txt', 'star\n');
    write('a.txt', 'a\n');
    commitAll('add both');
    write('a.txt', 'a again\n');
    commitAll('change a');
    expect(await subjects({ path: '*.txt' })).toEqual(['add both']);
  });

  it.each([
    ['a limit of zero', { path: 'docs/notes.md', limit: 0 }],
    [
      'a limit past the maximum',
      { path: 'docs/notes.md', limit: gitLimits.history.maxCommits + 1 },
    ],
    ['a fractional limit', { path: 'docs/notes.md', limit: 1.5 }],
    ['an empty path', { path: '' }],
  ])('refuses %s', async (_, request) => {
    renamedFile();
    await expect(list(request)).rejects.toMatchObject({
      name: 'InvalidHistoryRequestError',
    });
  });
});
