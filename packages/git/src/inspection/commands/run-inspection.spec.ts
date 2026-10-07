import { NodeServices } from '@effect/platform-node';
import { Cause, Duration, Effect, Exit, Fiber, Schedule } from 'effect';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInspection } from './run-inspection.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

let checkout: string;
function run<A, E>(work: Effect.Effect<A, E, NodeServices.NodeServices>) {
  return Effect.runPromise(work.pipe(Effect.provide(NodeServices.layer)));
}
function running(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'porcelain-inspection-process-'));
  execFileSync('git', ['init', '-q', checkout]);
});
afterEach(() => rmSync(checkout, { recursive: true, force: true }));

describe('inspection process limits', () => {
  it('turns excess Git output into an inspection limit failure', async () => {
    const failure = await run(
      Effect.flip(
        runInspection(checkout, ['--version'], gitLimits, { maxBytes: 1 }),
      ),
    );
    expect(failure).toMatchObject({
      name: 'InspectionLimitError',
      cause: { _tag: 'GitOutputLimitError' },
    });
  });

  it('preserves the typed timeout when Git outlives its deadline', async () => {
    const failure = await run(
      Effect.flip(
        runInspection(checkout, ['wait'], gitLimits, {
          config: ['alias.wait=!exec sleep 2 >/dev/null 2>&1 </dev/null'],
          timeoutMs: 100,
        }),
      ),
    );
    expect(failure).toMatchObject({ _tag: 'GitTimeoutError' });
  });

  it('interrupts inspection and waits for its real Git subprocess to stop', async () => {
    const pidFile = join(checkout, 'wait.pid');
    const outcome = await run(
      Effect.gen(function* () {
        const request = yield* Effect.forkChild(
          runInspection(checkout, ['wait'], gitLimits, {
            config: [`alias.wait=!echo $$ > '${pidFile}'; exec sleep 30`],
            timeoutMs: 30_000,
          }),
        );
        const pid = yield* Effect.try(() =>
          Number(readFileSync(pidFile, 'utf8').trim()),
        ).pipe(
          Effect.filterOrFail((value) => value > 0),
          Effect.retry(Schedule.spaced(Duration.millis(10))),
          Effect.timeout(Duration.seconds(5)),
        );
        const before = running(pid);
        yield* Fiber.interrupt(request);
        const exit = yield* Fiber.await(request);
        return {
          before,
          after: running(pid),
          interrupted:
            Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause),
        };
      }),
    );
    expect(outcome).toEqual({ before: true, after: false, interrupted: true });
  });
});
