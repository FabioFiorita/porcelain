import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';
import { readBranchRange } from './read-branch-range.ts';

let checkout: string;

const git = (...args: string[]) =>
  execFileSync(
    'git',
    ['-C', checkout, '-c', 'user.name=T', '-c', 'user.email=t@e', ...args],
    { encoding: 'utf8' },
  ).trim();

const write = (path: string, content: string) =>
  writeFileSync(join(checkout, path), content);

const commitAll = (message: string) => {
  git('add', '-A');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
};

const identityOf = (path: string) => {
  const info = statSync(path, { bigint: true });
  return `${info.dev}:${info.ino}:${info.birthtimeNs}`;
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

function forkFeature() {
  write('a.txt', 'one\ntwo\n');
  write('gone.txt', 'gone\n');
  write('old name.txt', 'moved\nunchanged\ncontent\n');
  write('shared.txt', 'shared\n');
  const fork = commitAll('base');
  git('switch', '-q', '-c', 'feature');
  write('a.txt', 'one\ntwo\nthree\n');
  write('new.txt', 'new\n');
  unlinkSync(join(checkout, 'gone.txt'));
  git('mv', 'old name.txt', 'new name.txt');
  commitAll('feature one');
  write('new.txt', 'new\nagain\n');
  const tip = commitAll('feature two');
  git('switch', '-q', 'main');
  write('shared.txt', 'shared\nmain moved on\n');
  const main = commitAll('main moves');
  git('switch', '-q', 'feature');
  return { fork, tip, main };
}

beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'porcelain-branch-range-'));
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
});

afterEach(() => {
  rmSync(checkout, { recursive: true, force: true });
});

const blob = (revision: string) => git('rev-parse', revision);
const version = Buffer.from('git version');
const read = (request: { base?: string }, limits = gitLimits) =>
  readBranchRange(historyCheckout(), version, request, limits);

describe('readBranchRange', () => {
  it('lists every file the branch changed since it forked from the default branch', async () => {
    const { fork, tip, main } = forkFeature();
    expect(await read({})).toEqual({
      kind: 'found',
      head: { oid: tip, ref: 'refs/heads/feature' },
      base: { ref: 'refs/heads/main', oid: main },
      mergeBaseOid: fork,
      commits: 2,
      files: [
        {
          oldPath: 'a.txt',
          newPath: 'a.txt',
          status: 'modified',
          oldMode: '100644',
          newMode: '100644',
          oldOid: blob(`${fork}:a.txt`),
          newOid: blob(`${tip}:a.txt`),
        },
        {
          oldPath: 'gone.txt',
          newPath: null,
          status: 'deleted',
          oldMode: '100644',
          newMode: '000000',
          oldOid: blob(`${fork}:gone.txt`),
          newOid: null,
        },
        {
          oldPath: 'old name.txt',
          newPath: 'new name.txt',
          status: 'renamed',
          oldMode: '100644',
          newMode: '100644',
          oldOid: blob(`${fork}:old name.txt`),
          newOid: blob(`${tip}:new name.txt`),
        },
        {
          oldPath: null,
          newPath: 'new.txt',
          status: 'added',
          oldMode: '000000',
          newMode: '100644',
          oldOid: null,
          newOid: blob(`${tip}:new.txt`),
        },
      ],
    });
  });

  it('leaves out what the base changed after the branch forked', async () => {
    forkFeature();
    const range = await read({});
    expect(
      range.kind === 'found' && range.files.map((file) => file.oldPath),
    ).not.toContain('shared.txt');
  });

  it('prefers the remote default branch over a stale local branch of the same name', async () => {
    const { fork, main } = forkFeature();
    git('branch', 'trunk', fork);
    git('update-ref', 'refs/remotes/origin/trunk', main);
    git(
      'symbolic-ref',
      'refs/remotes/origin/HEAD',
      'refs/remotes/origin/trunk',
    );
    const range = await read({});
    expect(range).toMatchObject({
      kind: 'found',
      base: { ref: 'refs/remotes/origin/trunk', oid: main },
    });
  });

  it('prefers the remote main over the local one when the remote names no default', async () => {
    const { fork } = forkFeature();
    git('update-ref', 'refs/remotes/origin/main', fork);
    expect(await read({})).toMatchObject({
      base: { ref: 'refs/remotes/origin/main', oid: fork },
    });
  });

  it('shows the unpushed commits of the local default branch against its remote', async () => {
    const { fork, main } = forkFeature();
    git('update-ref', 'refs/remotes/origin/main', fork);
    git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
    git('switch', '-q', 'main');
    expect(await read({})).toMatchObject({
      head: { oid: main, ref: 'refs/heads/main' },
      mergeBaseOid: fork,
      commits: 1,
    });
  });

  it('falls back to the local main when there is no remote', async () => {
    const { main } = forkFeature();
    expect(await read({})).toMatchObject({
      base: { ref: 'refs/heads/main', oid: main },
    });
  });

  it('falls back to the remote default branch when there is no local one', async () => {
    const { main } = forkFeature();
    git('update-ref', 'refs/remotes/origin/trunk', main);
    git(
      'symbolic-ref',
      'refs/remotes/origin/HEAD',
      'refs/remotes/origin/trunk',
    );
    expect(await read({})).toMatchObject({
      base: { ref: 'refs/remotes/origin/trunk', oid: main },
    });
  });

  it('falls back to master when there is no main', async () => {
    const { main } = forkFeature();
    git('branch', '-q', '-m', 'main', 'master');
    expect(await read({})).toMatchObject({
      base: { ref: 'refs/heads/master', oid: main },
    });
  });

  it('reports that no default base exists', async () => {
    const { tip } = forkFeature();
    git('branch', '-q', '-m', 'main', 'trunk');
    expect(await read({})).toEqual({
      kind: 'no-default-base',
      head: { oid: tip, ref: 'refs/heads/feature' },
    });
  });

  it('compares against a remote branch the reviewer chose', async () => {
    const { fork } = forkFeature();
    git('update-ref', 'refs/remotes/upstream/old', fork);
    expect(await read({ base: 'refs/remotes/upstream/old' })).toMatchObject({
      kind: 'found',
      base: { ref: 'refs/remotes/upstream/old', oid: fork },
      mergeBaseOid: fork,
    });
  });

  it('reports a chosen base that does not exist', async () => {
    forkFeature();
    expect(await read({ base: 'refs/heads/nope' })).toEqual({
      kind: 'missing-base',
    });
  });

  it('does not take a nested branch for the one that was chosen', async () => {
    const { fork } = forkFeature();
    git('branch', 'topic/nested', fork);
    expect(await read({ base: 'refs/heads/topic' })).toEqual({
      kind: 'missing-base',
    });
  });

  it.each([
    'main',
    'refs/tags/v1',
    'refs/heads/main~1',
    'refs/heads/main^{tree}',
  ])('refuses %s as a base', async (base) => {
    forkFeature();
    await expect(read({ base })).rejects.toMatchObject({
      name: 'InvalidHistoryRequestError',
    });
  });

  it('reports a branch with no history in common with its base', async () => {
    forkFeature();
    git('switch', '-q', '--orphan', 'island');
    write('island.txt', 'island\n');
    commitAll('island');
    expect(await read({})).toEqual({
      kind: 'unrelated',
    });
  });

  it('reports a branch that has no commits yet', async () => {
    expect(await read({})).toEqual({
      kind: 'unborn',
    });
  });

  it('reads a detached HEAD without a branch name', async () => {
    const { tip } = forkFeature();
    git('switch', '-q', '--detach');
    expect(await read({})).toMatchObject({
      head: { oid: tip, ref: null },
    });
  });

  it('refuses a range with more files than the limit', async () => {
    forkFeature();
    const limits = {
      ...gitLimits,
      history: { ...gitLimits.history, maxCommitFiles: 3 },
    };
    await expect(read({}, limits)).rejects.toMatchObject({
      name: 'ReadLimitExceededError',
    });
  });
});
