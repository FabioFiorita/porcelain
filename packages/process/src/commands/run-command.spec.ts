import { Deferred, Effect, Exit, Fiber, Cause } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { describe, expect, it } from 'vitest';
import { runCommand } from './run-command.ts';

const node = process.execPath;
const processGroup = { lingerMs: 250, cleanupMs: 5000, pollMs: 10 };
const forever = 'setInterval(() => {}, 1000)';
const spawnGrandchild = `const child = require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(forever)}], { stdio: 'ignore' }); child.unref(); process.stderr.write(String(child.pid));`;

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('runCommand', () => {
  it('returns what the command printed, having fed it the input', async () => {
    const output = await Effect.runPromise(
      runCommand({
        command: node,
        args: [
          '-e',
          "process.stdin.pipe(process.stdout); process.stderr.write('note')",
        ],
        stdin: 'hello',
        maxBytes: 1024,
        processGroup,
      }).pipe(Effect.provide(NodeServices.layer)),
    );
    expect({
      stdout: output.stdout.toString('utf8'),
      stderr: output.stderr.toString('utf8'),
      exitCode: output.exitCode,
      stopped: output.stopped,
    }).toEqual({
      stdout: 'hello',
      stderr: 'note',
      exitCode: 0,
      stopped: undefined,
    });
  });

  it('returns a non-zero exit as a fact instead of throwing', async () => {
    const output = await Effect.runPromise(
      runCommand({
        command: node,
        args: ['-e', 'process.exit(3)'],
        maxBytes: 1024,
        processGroup,
      }).pipe(Effect.provide(NodeServices.layer)),
    );
    expect(output.exitCode).toBe(3);
  });

  it('kills the child and grandchild before caller interruption completes', async () => {
    const started = Deferred.makeUnsafe<void>();
    let grandchild = 0;
    const fiber = Effect.runFork(
      runCommand({
        command: node,
        args: ['-e', `${spawnGrandchild} ${forever}`],
        maxBytes: 1024,
        processGroup,
        onStderr: (chunk) => {
          grandchild = Number(chunk.toString('utf8'));
          Deferred.doneUnsafe(started, Effect.void);
        },
      }).pipe(Effect.provide(NodeServices.layer)),
    );
    await Effect.runPromise(Deferred.await(started));
    await Effect.runPromise(Fiber.interrupt(fiber));
    const exit = await Effect.runPromise(Fiber.await(fiber));
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true,
    );
    expect(grandchild).toBeGreaterThan(0);
    expect(isRunning(grandchild)).toBe(false);
  });

  it('kills a grandchild left running after the child exits', async () => {
    const output = await Effect.runPromise(
      runCommand({
        command: node,
        args: ['-e', spawnGrandchild],
        maxBytes: 1024,
        processGroup,
      }).pipe(Effect.provide(NodeServices.layer)),
    );
    const grandchild = Number(output.stderr.toString('utf8'));
    expect({
      exitCode: output.exitCode,
      stopped: output.stopped,
      groupStopped: output.groupStopped,
      grandchildRunning: isRunning(grandchild),
    }).toEqual({
      exitCode: 0,
      stopped: 'lingering',
      groupStopped: true,
      grandchildRunning: false,
    });
  });

  it('stops a command whose output passes the byte cap and keeps no more than the cap', async () => {
    const output = await Effect.runPromise(
      runCommand({
        command: node,
        args: ['-e', `process.stdout.write('x'.repeat(4096)); ${forever}`],
        maxBytes: 16,
        processGroup,
      }).pipe(Effect.provide(NodeServices.layer)),
    );
    expect(output.stopped).toBe('output-limit');
    expect(output.stdout.length).toBeLessThanOrEqual(16);
  });

  it('keeps the first bytes of stderr past the byte cap, marks it truncated and lets the command finish', async () => {
    const output = await Effect.runPromise(
      runCommand({
        command: node,
        args: [
          '-e',
          "process.stderr.write('e'.repeat(4096)); process.stdout.write('plan'); process.exitCode = 0",
        ],
        maxBytes: 16,
        processGroup,
      }).pipe(Effect.provide(NodeServices.layer)),
    );
    expect({
      stdout: output.stdout.toString('utf8'),
      stderr: output.stderr.toString('utf8'),
      stderrTruncated: output.stderrTruncated,
      exitCode: output.exitCode,
      stopped: output.stopped,
    }).toEqual({
      stdout: 'plan',
      stderr: 'e'.repeat(16),
      stderrTruncated: true,
      exitCode: 0,
      stopped: undefined,
    });
  });

  it('stops a command that outlives its deadline', async () => {
    const output = await Effect.runPromise(
      runCommand({
        command: node,
        args: ['-e', forever],
        timeoutMs: 100,
        maxBytes: 1024,
        processGroup,
      }).pipe(Effect.provide(NodeServices.layer)),
    );
    expect([output.stopped, output.exitCode]).toEqual(['deadline', undefined]);
  });

  it('refuses to start once the caller has aborted', async () => {
    const exit = await Effect.runPromiseExit(
      runCommand({
        command: node,
        args: ['-e', ''],
        maxBytes: 1024,
        processGroup,
      }).pipe(Effect.provide(NodeServices.layer)),
      { signal: AbortSignal.abort() },
    );
    expect(Exit.hasInterrupts(exit)).toBe(true);
  });

  it('drains the owned process group when the native Effect caller is interrupted', async () => {
    const controller = new AbortController();
    const spawned = Promise.withResolvers<number>();
    const running = Effect.runPromiseExit(
      runCommand({
        command: node,
        args: ['-e', `${spawnGrandchild} ${forever}`],
        maxBytes: 1024,
        processGroup,
        onStderr: (chunk) => spawned.resolve(Number(chunk.toString('utf8'))),
      }).pipe(Effect.provide(NodeServices.layer)),
      { signal: controller.signal },
    );
    const grandchild = await spawned.promise;
    expect(isRunning(grandchild)).toBe(true);
    controller.abort();
    expect(Exit.hasInterrupts(await running)).toBe(true);
    expect(isRunning(grandchild)).toBe(false);
  });

  it('reports a missing executable through the native platform error channel', async () => {
    await expect(
      Effect.runPromise(
        runCommand({
          command: '/porcelain-missing-executable',
          args: [],
          maxBytes: 1024,
          processGroup,
        }).pipe(Effect.provide(NodeServices.layer)),
      ),
    ).rejects.toMatchObject({
      _tag: 'PlatformError',
      reason: { _tag: 'NotFound' },
    });
  });
});
