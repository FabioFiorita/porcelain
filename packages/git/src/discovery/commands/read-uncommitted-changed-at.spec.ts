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

function read(limits = gitLimits) {
  return Effect.runPromise(
    readUncommittedChangedAt(checkout, limits).pipe(
      Effect.provide(NodeServices.layer),
    ),
  );
}

function at(time: string) {
  utimesSync(checkout, new Date(time), new Date(time));
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
  write('nested/docs/file.md', 'nested\n', '2026-01-01T00:00:00.000Z');
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
  it('reads a clean worktree as clean', async () => {
    expect(await read()).toEqual({ kind: 'clean' });
  });

  it('is the newest change among edited and untracked files, ignoring unchanged and ignored ones', async () => {
    write('docs/edited.md', 'second\n', '2026-03-01T10:00:00.000Z');
    write('notes/new/draft.md', 'draft\n', '2026-03-02T09:30:00.000Z');
    write('kept.md', 'kept\n', '2026-04-01T00:00:00.000Z');
    write('build/output.txt', 'output\n', '2026-05-01T00:00:00.000Z');
    expect(await read()).toEqual({
      kind: 'dated',
      at: '2026-03-02T09:30:00.000Z',
    });
  });

  it('dates a deleted file by its folder', async () => {
    rmSync(join(checkout, 'removed.md'));
    at('2026-06-01T12:00:00.000Z');
    expect(await read()).toEqual({
      kind: 'dated',
      at: '2026-06-01T12:00:00.000Z',
    });
  });

  it('dates a deleted directory by the nearest folder that survives', async () => {
    rmSync(join(checkout, 'nested'), { recursive: true });
    at('2026-07-01T08:00:00.000Z');
    expect(await read()).toEqual({
      kind: 'dated',
      at: '2026-07-01T08:00:00.000Z',
    });
  });

  it('finds the newest change anywhere in a long list of changes', async () => {
    for (let index = 0; index < 2100; index += 1)
      write(
        `many/file-${String(index).padStart(4, '0')}.md`,
        'many\n',
        '2026-02-01T00:00:00.000Z',
      );
    write('many/file-2100.md', 'newest\n', '2026-08-01T00:00:00.000Z');
    expect(await read()).toEqual({
      kind: 'dated',
      at: '2026-08-01T00:00:00.000Z',
    });
  });

  it('fails instead of dating a status cut at its output limit', async () => {
    for (let index = 0; index < 50; index += 1)
      write(`cut/file-${index}.md`, 'cut\n', '2026-02-01T00:00:00.000Z');
    await expect(
      read({
        ...gitLimits,
        inspection: { ...gitLimits.inspection, statusBytes: 200 },
      }),
    ).rejects.toThrow();
  });
});
