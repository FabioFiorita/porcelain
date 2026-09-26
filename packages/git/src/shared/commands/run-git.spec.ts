import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runGitRead, runGitWrite } from './run-git.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

let repository: string;

beforeAll(() => {
  repository = mkdtempSync(join(tmpdir(), 'porcelain-run-git-'));
  execFileSync('git', ['init', '-q', repository]);
});

afterAll(() => {
  rmSync(repository, { recursive: true, force: true });
});

describe('runGitRead', () => {
  it('returns what Git printed', async () => {
    const output = await runGitRead(
      repository,
      ['rev-parse', '--is-inside-work-tree'],
      gitLimits,
    );
    expect(output.toString('utf8')).toBe('true\n');
  });

  it('reports a non-zero exit with its code and message', async () => {
    const failure = await runGitRead(
      repository,
      ['rev-parse', '--verify', 'refs/heads/missing'],
      gitLimits,
    ).catch((error: unknown) => error);
    expect(failure).toMatchObject({ name: 'GitCommandError', exitCode: 128 });
    expect(failure).not.toHaveProperty('stderr', '');
  });

  it('reports output beyond the byte limit as an output limit', async () => {
    await expect(
      runGitRead(repository, ['--version'], gitLimits, undefined, {
        maxBytes: 4,
      }),
    ).rejects.toMatchObject({ name: 'GitOutputLimitError' });
  });

  it('reports a command that outlives its deadline as a timeout', async () => {
    await expect(
      runGitRead(repository, ['wait'], gitLimits, undefined, {
        config: ['alias.wait=!exec sleep 2 >/dev/null 2>&1 </dev/null'],
        timeoutMs: 100,
      }),
    ).rejects.toMatchObject({ name: 'GitTimeoutError' });
  });

  it('lets the caller abort without dressing it up as a Git failure', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runGitRead(repository, ['--version'], gitLimits, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('runGitWrite', () => {
  it('returns the exit code instead of throwing', async () => {
    const result = await runGitWrite(
      repository,
      ['rev-parse', '--verify', '--quiet', 'refs/heads/missing'],
      gitLimits,
      AbortSignal.timeout(5000),
    );
    expect([
      result.exitCode,
      result.interrupted,
      result.descendantsStopped,
    ]).toEqual([1, false, true]);
  });

  it('stops Git and marks the result when output passes the byte limit', async () => {
    const result = await runGitWrite(
      repository,
      ['--version'],
      gitLimits,
      AbortSignal.timeout(5000),
      { maxBytes: 4 },
    );
    expect([result.failure, result.interrupted]).toEqual([
      'output-limit',
      true,
    ]);
  });

  it('streams each line Git writes to standard error as progress', async () => {
    const lines: string[] = [];
    await runGitWrite(
      repository,
      ['talk'],
      gitLimits,
      AbortSignal.timeout(5000),
      {
        onProgress: (line) => lines.push(line),
      },
    );
    expect(lines).toContainEqual(
      expect.stringContaining("'talk' is not a git command"),
    );
  });
});
