import { NodeServices } from '@effect/platform-node';
import { Effect, Exit, Fiber } from 'effect';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';
import { runHistory } from './run-history.ts';

let checkout: string;

beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'porcelain-history-process-'));
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
});

afterEach(() => {
  rmSync(checkout, { recursive: true, force: true });
});

const failure = (args: readonly string[], limits = gitLimits) =>
  Effect.runPromise(
    Effect.flip(runHistory(checkout, args, limits)).pipe(
      Effect.provide(NodeServices.layer),
    ),
  );

describe('runHistory', () => {
  it('reports a missing revision as an unavailable history snapshot', async () => {
    expect(await failure(['show', '1'.repeat(40)])).toMatchObject({
      name: 'HistorySnapshotUnavailableError',
      cause: { _tag: 'GitCommandError', exitCode: 128 },
    });
  });

  it('reports output beyond the history read cap as a read limit', async () => {
    expect(
      await failure(['--version'], { ...gitLimits, outputBytes: 1 }),
    ).toMatchObject({
      name: 'ReadLimitExceededError',
      cause: { _tag: 'GitOutputLimitError' },
    });
  });

  it('keeps a Git deadline as a typed timeout', async () => {
    expect(
      await failure(['-c', 'alias.wait=!sleep 5', 'wait'], {
        ...gitLimits,
        readTimeoutMs: 50,
      }),
    ).toMatchObject({ _tag: 'GitTimeoutError' });
  });

  it('interrupts the owned Git process without turning interruption into a snapshot failure', async () => {
    const marker = join(checkout, 'started');
    const fiber = Effect.runFork(
      runHistory(
        checkout,
        ['-c', 'alias.wait=!echo $$ > started; exec sleep 30', 'wait'],
        gitLimits,
      ).pipe(Effect.provide(NodeServices.layer)),
    );
    try {
      for (
        let attempts = 0;
        attempts < 100 && !existsSync(marker);
        attempts += 1
      )
        await new Promise((resolve) => setTimeout(resolve, 10));
      expect(existsSync(marker)).toBe(true);
      const pid = Number(readFileSync(marker, 'utf8').trim());
      expect(pid).toBeGreaterThan(0);
      process.kill(pid, 0);
      await Effect.runPromise(Fiber.interrupt(fiber));
      expect(
        Exit.hasInterrupts(await Effect.runPromise(Fiber.await(fiber))),
      ).toBe(true);
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      await Effect.runPromise(Fiber.interrupt(fiber));
    }
  });
});
