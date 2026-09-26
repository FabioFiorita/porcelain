import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isAncestorOfHead } from './is-ancestor.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

let checkout: string;
let first: string;
let side: string;

const git = (...args: string[]) =>
  execFileSync(
    'git',
    ['-C', checkout, '-c', 'user.name=T', '-c', 'user.email=t@e', ...args],
    { encoding: 'utf8' },
  ).trim();

beforeAll(() => {
  checkout = mkdtempSync(join(tmpdir(), 'porcelain-ancestor-'));
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
  git('commit', '-q', '--allow-empty', '-m', 'first');
  first = git('rev-parse', 'HEAD');
  git('commit', '-q', '--allow-empty', '-m', 'second');
  git('switch', '-q', '-c', 'side', first);
  git('commit', '-q', '--allow-empty', '-m', 'side');
  side = git('rev-parse', 'HEAD');
  git('switch', '-q', 'main');
});

afterAll(() => {
  rmSync(checkout, { recursive: true, force: true });
});

describe('isAncestorOfHead', () => {
  it('answers yes for a commit HEAD descends from', async () => {
    expect(await isAncestorOfHead(checkout, first, gitLimits)).toBe(true);
  });

  it('answers no for a commit on another line of history', async () => {
    expect(await isAncestorOfHead(checkout, side, gitLimits)).toBe(false);
  });

  it('answers no for a commit the repository does not have', async () => {
    expect(await isAncestorOfHead(checkout, '1'.repeat(40), gitLimits)).toBe(
      false,
    );
  });

  it('reports a repository it cannot read as an unavailable snapshot', async () => {
    await expect(
      isAncestorOfHead(join(checkout, 'missing'), first, gitLimits),
    ).rejects.toMatchObject({ name: 'HistorySnapshotUnavailableError' });
  });
});
