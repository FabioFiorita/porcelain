import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  lstatSync,
  mkdirSync,
  renameSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { readWorkingTree } from './read-working-tree.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

let checkout: string;
const git = (...args: string[]) =>
  execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
const write = (name: string, text: string) =>
  writeFileSync(join(checkout, name), text);
const capture = (base?: string) =>
  Effect.runPromise(
    readWorkingTree(checkout, base, gitLimits).pipe(
      Effect.provide(NodeServices.layer),
    ),
  );
const bytes = (root: string): Record<string, string> =>
  Object.fromEntries(
    readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((name) => lstatSync(join(root, name)).isFile())
      .map((name) => [
        relative(checkout, join(root, name)),
        readFileSync(join(root, name)).toString('hex'),
      ]),
  );

beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'walkthrough-tree-test-'));
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  write('tracked.txt', 'first\nsecond\nthird\n');
  write('deleted.txt', 'remove me\n');
  write('.gitignore', 'ignored/\n');
  git('add', '--all');
  git('commit', '-qm', 'Base');
});
afterEach(() => rmSync(checkout, { recursive: true, force: true }));

it('identifies full content equally before and after committing it, with pinned hunks and renames', async () => {
  const base = git('rev-parse', 'HEAD');
  write('tracked.txt', 'first\nstaged\nthird\n');
  git('add', 'tracked.txt');
  write('tracked.txt', 'first\nworking\nthird\n');
  renameSync(join(checkout, 'deleted.txt'), join(checkout, 'renamed.txt'));
  write('untracked.txt', 'new\nfile\n');
  const before = await capture(base);
  expect(before.treeOid).not.toBe(before.headTreeOid);
  expect([...before.sections.keys()]).toEqual([
    'deleted.txt\0renamed.txt',
    'tracked.txt',
    'untracked.txt',
  ]);
  expect(before.patch).toContain('+working');
  expect(before.patch).not.toContain('+staged');
  expect(before.patch).toContain('+new\n+file');
  git('add', '--all');
  git('commit', '-qm', 'Commit the same content');
  const after = await capture(base);
  expect(after.treeOid).toBe(before.treeOid);
  expect(after.treeOid).toBe(after.headTreeOid);
  expect(after.patch).toBe(before.patch);
});

it('changes identity on edits, additions and deletions but not ignored files', async () => {
  const clean = await capture();
  mkdirSync(join(checkout, 'ignored'));
  write('ignored/cache', 'ignored bytes');
  expect((await capture()).treeOid).toBe(clean.treeOid);
  write('tracked.txt', 'edited\n');
  const edited = await capture();
  expect(edited.treeOid).not.toBe(clean.treeOid);
  write('new.txt', 'untracked\n');
  const added = await capture();
  expect(added.treeOid).not.toBe(edited.treeOid);
  rmSync(join(checkout, 'deleted.txt'));
  expect((await capture()).treeOid).not.toBe(added.treeOid);
});

it('leaves every checkout and Git metadata byte untouched, including a split index', async () => {
  git('config', 'core.splitIndex', 'true');
  git('update-index', '--split-index');
  write('tracked.txt', 'staged\n');
  git('add', 'tracked.txt');
  write('new.txt', 'untracked\n');
  const before = bytes(checkout);
  expect(before['tracked.txt']).toBe('7374616765640a');
  await capture(git('rev-parse', 'HEAD'));
  expect(bytes(checkout)).toEqual(before);
});

it('captures a linked checkout without touching its shared repository or private index', async () => {
  const primary = checkout;
  const linked = join(primary, 'linked');
  git('worktree', 'add', '-qb', 'topic', linked);
  try {
    checkout = linked;
    write('new file.txt', 'linked addition\n');
    const before = bytes(join(primary, '.git'));
    const snapshot = await capture(git('rev-parse', 'HEAD'));
    expect([...snapshot.sections.keys()]).toEqual(['new file.txt']);
    expect(snapshot.patch).toContain('+linked addition');
    expect(bytes(join(primary, '.git'))).toEqual(before);
  } finally {
    checkout = primary;
  }
});

it('refuses conversion filters on untracked additions before any filter can execute', async () => {
  write('.gitattributes', '*.secret filter=side-effect\n');
  git('config', 'filter.side-effect.clean', 'touch filter-executed');
  write('new.secret', 'secret\n');
  await expect(capture()).rejects.toThrow();
  expect(readdirSync(checkout)).not.toContain('filter-executed');
});
