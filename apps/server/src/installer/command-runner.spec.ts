import { NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { commandRunner } from './command-runner.ts';

const run = (args: readonly string[]) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const command = yield* commandRunner({
        timeoutMs: 1000,
        maxBytes: 4096,
        processGroup: { lingerMs: 10, cleanupMs: 100, pollMs: 1 },
      });
      return yield* command(process.execPath, args);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

it('collects the real child process output and exit reason', async () => {
  expect(await run(['-e', 'process.stdout.write("ready")'])).toEqual({
    code: 0,
    stdout: 'ready',
    stderr: '',
  });
  expect(
    await run(['-e', 'process.stderr.write("failed"); process.exitCode = 7']),
  ).toEqual({ code: 7, stdout: '', stderr: 'failed' });
});

it('stops and drains an owned child that exceeds its command deadline', async () => {
  const answer = await run(['-e', 'setInterval(() => {}, 1000)']);
  expect(answer.code).toBe(1);
  expect(answer.stderr).toContain('Command failed:');
});
