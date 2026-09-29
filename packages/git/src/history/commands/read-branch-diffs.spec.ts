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
import { readBranchDiffs } from './read-branch-diffs.ts';

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

const patchOf = (
  read: Awaited<ReturnType<typeof readBranchDiffs>>,
  key: string,
) => {
  if (read.kind !== 'read') return undefined;
  const section = read.sections?.get(key);
  return section?.kind === 'text' ? section.patch : undefined;
};

const readDiffs = (request: Parameters<typeof readBranchDiffs>[1]) =>
  readBranchDiffs(historyCheckout(), request, gitLimits);

describe('readBranchDiffs', () => {
  it('reads the patch of each file between the fork point and the tip', async () => {
    const { fork, tip } = forkFeature();
    const read = await readDiffs({
      baseOid: fork,
      headOid: tip,
      paths: [['new.txt'], ['a.txt']],
    });
    expect(patchOf(read, 'a.txt')).toMatch(/^\+three$/mu);
    expect(patchOf(read, 'new.txt')).toMatch(/^\+again$/mu);
  });

  it('reads a rename under both of its paths', async () => {
    const { fork, tip } = forkFeature();
    const read = await readDiffs({
      baseOid: fork,
      headOid: tip,
      paths: [['old name.txt', 'new name.txt']],
    });
    expect(
      read.kind === 'read' && read.sections?.get('old name.txt\0new name.txt'),
    ).toMatchObject({ kind: 'metadata-only' });
  });

  it('reports a commit the repository does not have', async () => {
    const { tip } = forkFeature();
    expect(
      await readDiffs({
        baseOid: '1'.repeat(40),
        headOid: tip,
        paths: [['a.txt']],
      }),
    ).toEqual({ kind: 'missing' });
  });

  it('refuses a request without paths', async () => {
    const { fork, tip } = forkFeature();
    await expect(
      readDiffs({ baseOid: fork, headOid: tip, paths: [] }),
    ).rejects.toMatchObject({ name: 'InvalidHistoryRequestError' });
  });
});
