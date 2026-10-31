import { Effect } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, devNull } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { readWorktreeSummary } from './read-worktree-summary.ts';
import { runInspection } from './run-inspection.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';
let checkout: string;
const git = (...args: string[]) =>
  execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
const write = (name: string, content: string | Buffer) =>
  writeFileSync(join(checkout, name), content);
const commit = () => {
  git('add', '--all');
  git('commit', '-qm', 'Prepare baseline');
};
const read = () =>
  Effect.runPromise(
    readWorktreeSummary(
      {
        path: checkout,
        verify: () => Effect.void,
        confirm: () => Effect.void,
        conversionFilters: (effect) => effect,
      },
      gitLimits,
    ).pipe(Effect.provide(NodeServices.layer)),
  );
beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'porcelain-numstat-'));
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
});
afterEach(() => rmSync(checkout, { recursive: true, force: true }));
it('counts the net HEAD-to-worktree change once across index and working copy and includes untracked files', async () => {
  write('tracked.txt', 'one\ntwo\nthree\n');
  commit();
  write('tracked.txt', 'one\nstaged\nthree\n');
  git('add', 'tracked.txt');
  write('tracked.txt', 'one\nfinal\nthree\nadded\n');
  write('new\tfile\n.txt', 'first\nsecond');
  const indexBefore = readFileSync(join(checkout, '.git/index'));
  expect(await read()).toEqual({ additions: 4, deletions: 1, binaryFiles: 0 });
  expect(readFileSync(join(checkout, '.git/index'))).toEqual(indexBefore);
});
it('keeps pure renames at zero and counts deleted lines', async () => {
  write('before.txt', 'same\ncontent\n');
  write('deleted.txt', 'old\nlines\n');
  commit();
  renameSync(join(checkout, 'before.txt'), join(checkout, 'after.txt'));
  git('add', '--all');
  rmSync(join(checkout, 'deleted.txt'));
  expect(await read()).toEqual({ additions: 0, deletions: 2, binaryFiles: 0 });
});
it('counts text in an unborn repository without inventing a HEAD', async () => {
  write('staged.txt', 'a\nb\n');
  git('add', 'staged.txt');
  write('staged.txt', 'a\nb\nc\n');
  write('untracked.txt', 'new\n');
  expect(await read()).toEqual({ additions: 4, deletions: 0, binaryFiles: 0 });
});
it('reports binary files separately from line totals', async () => {
  write('tracked.bin', Buffer.from([0, 1, 2]));
  commit();
  write('tracked.bin', Buffer.from([0, 2, 3]));
  write('new.bin', Buffer.from([0, 4, 5]));
  expect(await read()).toEqual({ additions: 0, deletions: 0, binaryFiles: 2 });
});
it('counts a symlink as its Git content instead of following the target', async () => {
  write('tracked.txt', 'base\n');
  commit();
  symlinkSync('/definitely-not-a-worktree-file', join(checkout, 'new-link'));
  expect(await read()).toEqual({ additions: 1, deletions: 0, binaryFiles: 0 });
});
it('keeps a staged edit undone in the working tree at net zero', async () => {
  write('tracked.txt', 'base\n');
  commit();
  write('tracked.txt', 'changed\n');
  git('add', 'tracked.txt');
  write('tracked.txt', 'base\n');
  expect(await read()).toEqual({ additions: 0, deletions: 0, binaryFiles: 0 });
});

it('does not interpret a missing untracked file error as an empty difference', async () => {
  await expect(
    Effect.runPromise(
      runInspection(
        checkout,
        [
          'diff',
          '--no-index',
          '--numstat',
          '-z',
          '--',
          devNull,
          'missing-file',
        ],
        gitLimits,
        { allowDifference: true },
      ).pipe(Effect.provide(NodeServices.layer)),
    ),
  ).rejects.toMatchObject({ _tag: 'GitCommandError', exitCode: 1 });
});
it('accepts a zero-line untracked file without hiding its metadata-only change', async () => {
  write('base.txt', 'base\n');
  commit();
  write('empty.txt', '');
  expect(await read()).toEqual({ additions: 0, deletions: 0, binaryFiles: 0 });
});
