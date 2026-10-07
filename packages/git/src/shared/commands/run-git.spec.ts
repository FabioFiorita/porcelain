import { NodeServices } from '@effect/platform-node';
import { Duration, Effect, Fiber, Schedule } from 'effect';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gitRead, gitWrite } from './run-git.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

let repository: string;

beforeAll(() => {
  repository = mkdtempSync(join(tmpdir(), 'porcelain-run-git-'));
  execFileSync('git', ['init', '-q', repository]);
});

afterAll(() => {
  rmSync(repository, { recursive: true, force: true });
});

function run<A, E>(effect: Effect.Effect<A, E, NodeServices.NodeServices>) {
  return Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)));
}

function failure<A, E>(effect: Effect.Effect<A, E, NodeServices.NodeServices>) {
  return run(Effect.flip(effect));
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function writtenPid(file: string) {
  return Effect.try(() => readFileSync(file, 'utf8')).pipe(
    Effect.map((text) => Number(text.trim())),
    Effect.flatMap((pid) =>
      pid > 0 ? Effect.succeed(pid) : Effect.fail('not written yet'),
    ),
    Effect.retry(Schedule.spaced(Duration.millis(10))),
    Effect.timeout(Duration.seconds(5)),
  );
}

describe('gitRead', () => {
  it('returns what Git printed', async () => {
    const output = await run(
      gitRead(repository, ['rev-parse', '--is-inside-work-tree'], gitLimits),
    );
    expect(output.toString('utf8')).toBe('true\n');
  });

  it('fails with the exit code and message of a Git command that refuses', async () => {
    const error = await failure(
      gitRead(
        repository,
        ['rev-parse', '--verify', 'refs/heads/missing'],
        gitLimits,
      ),
    );
    expect(error).toMatchObject({
      _tag: 'GitCommandError',
      checkout: repository,
      args: ['rev-parse', '--verify', 'refs/heads/missing'],
      exitCode: 128,
    });
    expect(error).not.toHaveProperty('stderr', '');
  });

  it('fails with an output limit when Git prints more than the byte limit', async () => {
    const error = await failure(
      gitRead(repository, ['--version'], gitLimits, { maxBytes: 4 }),
    );
    expect(error._tag).toBe('GitOutputLimitError');
  });

  it('fails with a timeout when Git outlives its deadline', async () => {
    const error = await failure(
      gitRead(repository, ['wait'], gitLimits, {
        config: ['alias.wait=!exec sleep 2 >/dev/null 2>&1 </dev/null'],
        timeoutMs: 100,
      }),
    );
    expect(error._tag).toBe('GitTimeoutError');
  });

  it('stops Git and the processes it started when the caller is interrupted', async () => {
    const pidFile = join(repository, 'wait.pid');
    const observed = await run(
      Effect.gen(function* () {
        const request = yield* Effect.forkChild(
          gitRead(repository, ['wait'], gitLimits, {
            config: [`alias.wait=!echo $$ > '${pidFile}'; exec sleep 30`],
            timeoutMs: 30_000,
          }),
        );
        const pid = yield* writtenPid(pidFile);
        const before = isRunning(pid);
        yield* Fiber.interrupt(request);
        return { before, after: isRunning(pid) };
      }),
    );
    expect(observed).toEqual({ before: true, after: false });
  });
});

describe('gitWrite', () => {
  it('returns the exit code of a Git command that refuses', async () => {
    const result = await run(
      gitWrite(
        repository,
        ['rev-parse', '--verify', '--quiet', 'refs/heads/missing'],
        gitLimits,
      ),
    );
    expect([
      result.exitCode,
      result.interrupted,
      result.descendantsStopped,
    ]).toEqual([1, false, true]);
  });

  it('stops Git and marks the result when output passes the byte limit', async () => {
    const result = await run(
      gitWrite(repository, ['--version'], gitLimits, { maxBytes: 4 }),
    );
    expect([result.failure, result.interrupted]).toEqual([
      'output-limit',
      true,
    ]);
  });

  it('streams each line Git writes to standard error as progress', async () => {
    const lines: string[] = [];
    await run(
      gitWrite(repository, ['talk'], gitLimits, {
        onProgress: (line) => lines.push(line),
      }),
    );
    expect(lines).toContainEqual(
      expect.stringContaining("'talk' is not a git command"),
    );
  });
});
