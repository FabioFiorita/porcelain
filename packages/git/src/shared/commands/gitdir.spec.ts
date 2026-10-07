import { NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseGitdirFile,
  readGitDirectory,
  readCommonDirectory,
  readWorktreeRegistry,
  contained,
  corroborates,
} from './gitdir.ts';

describe('parseGitdirFile', () => {
  it('reads the pointer Git writes into a linked worktree', () => {
    expect(parseGitdirFile('gitdir: /work/repo/.git/worktrees/feature\n')).toBe(
      '/work/repo/.git/worktrees/feature',
    );
  });

  it('keeps a relative pointer for the caller to resolve', () => {
    expect(parseGitdirFile('gitdir: ../repo/.git/worktrees/feature\r\n')).toBe(
      '../repo/.git/worktrees/feature',
    );
  });

  it('refuses a file that is not a gitdir pointer', () => {
    expect([
      parseGitdirFile(''),
      parseGitdirFile('gitdir:   \n'),
      parseGitdirFile('ref: refs/heads/main\n'),
      parseGitdirFile('gitdir: /a\n/b\n'),
      parseGitdirFile('gitdir: /a\0b'),
    ]).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });
});

describe('Effect Git metadata', () => {
  it('resolves the real linked worktree and refuses an administrative directory outside its registry', async ({
    onTestFinished,
  }) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'porcelain-gitdir-')));
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const main = join(root, 'main');
    const linked = join(root, 'linked');
    execFileSync('git', ['init', '-q', '-b', 'main', main]);
    execFileSync('git', [
      '-C',
      main,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'start',
    ]);
    execFileSync('git', [
      '-C',
      main,
      'worktree',
      'add',
      '-q',
      '-b',
      'feature',
      linked,
    ]);
    const common = join(main, '.git');
    const administrative = join(common, 'worktrees', 'linked');
    const outside = join(common, 'worktrees', 'outside');
    symlinkSync(main, outside, 'dir');
    const found = await Effect.runPromise(
      Effect.gen(function* () {
        const directory = yield* readGitDirectory(linked);
        return {
          directory,
          common:
            directory === undefined
              ? undefined
              : yield* readCommonDirectory(directory),
          mainCommon: yield* readCommonDirectory(common),
          registry: [...(yield* readWorktreeRegistry(common))],
          linkedContained: yield* contained(administrative, common),
          outsideContained: yield* contained(outside, common),
          linkedMatches: yield* corroborates(linked, administrative),
          mainMatchesLinked: yield* corroborates(main, administrative),
        };
      }).pipe(Effect.provide(NodeServices.layer)),
    );
    expect(found).toEqual({
      directory: administrative,
      common,
      mainCommon: common,
      registry: [[linked, administrative]],
      linkedContained: true,
      outsideContained: false,
      linkedMatches: true,
      mainMatchesLinked: false,
    });
  });

  it('treats a metadata path that is not a directory as missing registry metadata', async ({
    onTestFinished,
  }) => {
    const root = mkdtempSync(join(tmpdir(), 'porcelain-gitdir-missing-'));
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const file = join(root, 'file');
    writeFileSync(file, 'ordinary file');
    const found = await Effect.runPromise(
      Effect.gen(function* () {
        return {
          common: yield* readCommonDirectory(file),
          registry: [...(yield* readWorktreeRegistry(file))],
        };
      }).pipe(Effect.provide(NodeServices.layer)),
    );
    expect(found).toEqual({ common: file, registry: [] });
  });
});
