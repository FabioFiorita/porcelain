import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { describe, expect, it, onTestFinished } from 'vitest';
import { createPlayground } from './create-playground.ts';

describe('Disposable playground', () => {
  it('seeds linked worktrees, review changes and a local remote without using personal Git configuration', async () => {
    const fixture = await createPlayground();
    onTestFinished(() => rm(fixture.root, { recursive: true, force: true }));
    const git = async (...args: string[]) =>
      (
        await promisify(execFile)('git', ['-C', fixture.worktree, ...args], {
          env: fixture.environment,
        })
      ).stdout;
    expect(await git('worktree', 'list', '--porcelain')).toContain(
      fixture.project,
    );
    expect(await git('worktree', 'list', '--porcelain')).toContain(
      fixture.worktree,
    );
    expect(await git('status', '--porcelain')).toContain('MM README.md');
    expect(await git('status', '--porcelain')).toContain('?? notes.txt');
    expect(await git('remote', 'get-url', 'origin')).toBe(
      `${fixture.remote}\n`,
    );
    expect((await git('log', '--format=%s')).trim().split('\n')).toHaveLength(
      2,
    );
    expect(await readFile(fixture.tokenFile, 'utf8')).toBe(fixture.token);
  });
});
