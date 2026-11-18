import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readUncommittedChangedAt } from './read-uncommitted-changed-at.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

let checkout: string;

function git(...args: string[]) {
  execFileSync('git', args, { cwd: checkout, stdio: 'ignore' });
}

function write(path: string, content: string, at: string) {
  const target = join(checkout, path);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, content);
  utimesSync(target, new Date(at), new Date(at));
}

function read() {
  return Effect.runPromise(
    readUncommittedChangedAt(checkout, gitLimits).pipe(
      Effect.provide(NodeServices.layer),
    ),
  );
}

beforeEach(() => {
  checkout = realpathSync(
    mkdtempSync(join(temporaryRoot, 'porcelain-uncommitted-')),
  );
  git('init', '-q', '-b', 'main');
  write('.gitignore', 'build/\n', '2026-01-01T00:00:00.000Z');
  write('kept.md', 'kept\n', '2026-01-01T00:00:00.000Z');
  write('docs/edited.md', 'first\n', '2026-01-01T00:00:00.000Z');
  write('removed.md', 'removed\n', '2026-01-01T00:00:00.000Z');
  git('add', '.');
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '-q',
    '-m',
    'start',
  );
});

afterEach(() => {
  rmSync(checkout, { recursive: true, force: true });
});

describe('readUncommittedChangedAt', () => {
  it('has no time for a clean worktree', async () => {
    expect(await read()).toBeUndefined();
  });

  it('is the newest change among edited and untracked files, ignoring unchanged and ignored ones', async () => {
    write('docs/edited.md', 'second\n', '2026-03-01T10:00:00.000Z');
    write('notes/new/draft.md', 'draft\n', '2026-03-02T09:30:00.000Z');
    write('kept.md', 'kept\n', '2026-04-01T00:00:00.000Z');
    write('build/output.txt', 'output\n', '2026-05-01T00:00:00.000Z');
    expect(await read()).toBe('2026-03-02T09:30:00.000Z');
  });

  it('dates a deleted file by its folder', async () => {
    rmSync(join(checkout, 'removed.md'));
    utimesSync(
      checkout,
      new Date('2026-06-01T12:00:00.000Z'),
      new Date('2026-06-01T12:00:00.000Z'),
    );
    expect(await read()).toBe('2026-06-01T12:00:00.000Z');
  });
});
