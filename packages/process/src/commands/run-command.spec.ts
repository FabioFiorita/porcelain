import { TestClock } from 'effect/testing';
import { Deferred, Effect, Exit, Fiber, Cause } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { describe, expect, it } from '@effect/vitest';
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
  it.effect('returns what the command printed, having fed it the input', () =>
    Effect.gen(function* () {
      const output = yield* runCommand({
        command: node,
        args: [
          '-e',
          "process.stdin.pipe(process.stdout); process.stderr.write('note')",
        ],
        stdin: 'hello',
        maxBytes: 1024,
        processGroup,
      }).pipe(Effect.provide(NodeServices.layer));
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
    }).pipe(TestClock.withLive),
  );

  it.effect('returns a non-zero exit as a fact instead of throwing', () =>
    Effect.gen(function* () {
      const output = yield* runCommand({
        command: node,
        args: ['-e', 'process.exit(3)'],
        maxBytes: 1024,
        processGroup,
      }).pipe(Effect.provide(NodeServices.layer));
      expect(output.exitCode).toBe(3);
    }).pipe(TestClock.withLive),
  );

  it.effect(
    'kills the child and grandchild before caller interruption completes',
    () =>
      Effect.gen(function* () {
        const started = Deferred.makeUnsafe<void>();
        let grandchild = 0;
        const fiber = yield* Effect.forkChild(
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
        yield* Deferred.await(started);
        expect(isRunning(grandchild)).toBe(true);
        yield* Fiber.interrupt(fiber);
        const exit = yield* Fiber.await(fiber);
        expect(
          Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause),
        ).toBe(true);
        expect(grandchild).toBeGreaterThan(0);
        expect(isRunning(grandchild)).toBe(false);
      }).pipe(TestClock.withLive),
  );

  it.effect('kills a grandchild left running after the child exits', () =>
    Effect.gen(function* () {
      const output = yield* runCommand({
        command: node,
        args: ['-e', spawnGrandchild],
        maxBytes: 1024,
        processGroup,
      }).pipe(Effect.provide(NodeServices.layer));
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
    }).pipe(TestClock.withLive),
  );

  it.effect(
    'stops a command whose output passes the byte cap and keeps no more than the cap',
    () =>
      Effect.gen(function* () {
        const output = yield* runCommand({
          command: node,
          args: ['-e', `process.stdout.write('x'.repeat(4096)); ${forever}`],
          maxBytes: 16,
          processGroup,
        }).pipe(Effect.provide(NodeServices.layer));
        expect(output.stopped).toBe('output-limit');
        expect(output.stdout.length).toBeLessThanOrEqual(16);
      }).pipe(TestClock.withLive),
  );

  it.effect(
    'keeps the first bytes of stderr past the byte cap, marks it truncated and lets the command finish',
    () =>
      Effect.gen(function* () {
        const output = yield* runCommand({
          command: node,
          args: [
            '-e',
            "process.stderr.write('e'.repeat(4096)); process.stdout.write('plan'); process.exitCode = 0",
          ],
          maxBytes: 16,
          processGroup,
        }).pipe(Effect.provide(NodeServices.layer));
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
      }).pipe(TestClock.withLive),
  );

  it.effect('stops a command that outlives its deadline', () =>
    Effect.gen(function* () {
      const output = yield* runCommand({
        command: node,
        args: ['-e', forever],
        timeoutMs: 100,
        maxBytes: 1024,
        processGroup,
      }).pipe(Effect.provide(NodeServices.layer));
      expect([output.stopped, output.exitCode]).toEqual([
        'deadline',
        undefined,
      ]);
    }).pipe(TestClock.withLive),
  );

  it.effect('refuses to start once the caller has been interrupted', () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Effect.interrupt.pipe(
          Effect.andThen(
            runCommand({
              command: node,
              args: ['-e', ''],
              maxBytes: 1024,
              processGroup,
            }).pipe(Effect.provide(NodeServices.layer)),
          ),
        ),
      );
      expect(Exit.hasInterrupts(exit)).toBe(true);
    }).pipe(TestClock.withLive),
  );

  it.effect(
    'reports a missing executable through the native platform error channel',
    () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          runCommand({
            command: '/porcelain-missing-executable',
            args: [],
            maxBytes: 1024,
            processGroup,
          }).pipe(Effect.provide(NodeServices.layer)),
        );
        expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toMatchObject({
          _tag: 'PlatformError',
          reason: { _tag: 'NotFound' },
        });
      }).pipe(TestClock.withLive),
  );
});
