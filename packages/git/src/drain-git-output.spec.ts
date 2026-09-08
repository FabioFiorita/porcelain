import { PassThrough } from 'node:stream';
import { expect, it } from 'vitest';
import { drainGitOutput } from './drain-git-output.ts';

it('waits for both output streams to end after their producer exits', async () => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const output: Buffer[] = [];
  stdout.on('data', (chunk: Buffer) => output.push(chunk));
  stderr.resume();
  const state = { complete: false };
  const draining = drainGitOutput(
    stdout,
    stderr,
    AbortSignal.timeout(5000),
  ).then((drained) => {
    state.complete = true;
    return drained;
  });
  stdout.write('before exit');
  await Promise.resolve();
  expect(state.complete).toBe(false);
  stdout.end(' queued tail');
  await Promise.resolve();
  expect(state.complete).toBe(false);
  stderr.end('last diagnostic');
  expect(await draining).toBe(true);
  expect(Buffer.concat(output).toString()).toBe('before exit queued tail');
});

it('reports incomplete output when an inherited pipe outlives the cleanup deadline', async () => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  stdout.resume();
  stderr.resume();
  const deadline = new AbortController();
  const draining = drainGitOutput(stdout, stderr, deadline.signal);
  stdout.end('complete stdout');
  // The independent cleanup deadline expires while the other pipe remains open.
  deadline.abort();
  expect(await draining).toBe(false);
  stdout.destroy();
  stderr.destroy();
});
