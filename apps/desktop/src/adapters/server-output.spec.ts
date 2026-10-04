import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, onTestFinished } from 'vitest';
import { drainServerOutput } from './server-output.ts';

const token = '7dc5785f-833e-48c8-a0be-7c10a36093fb';
const end = Buffer.from(`\0Porcelain output complete: ${token}\0`);

async function output(bytes: Buffer, highWaterMark?: number) {
  const folder = await mkdtemp(join(tmpdir(), 'porcelain-output-'));
  const file = join(folder, 'output');
  await writeFile(file, bytes);
  const input = createReadStream(file, { highWaterMark });
  onTestFinished(async () => {
    input.destroy();
    await rm(folder, { recursive: true, force: true });
  });
  const chunks: Buffer[] = [];
  const drained = drainServerOutput(input, token, (chunk) =>
    chunks.push(chunk),
  );
  return { input, drained, read: () => Buffer.concat(chunks) };
}

test('ordinary output is available before shutdown, without waiting for a line or EOF', async () => {
  const bytes = Buffer.from('ordinary output without a newline');
  const pipe = await output(Buffer.concat([bytes, end]), bytes.length);
  const observed = await new Promise<{ bytes: Buffer; ended: boolean }>(
    (resolve) =>
      pipe.input.once('data', () =>
        resolve({ bytes: pipe.read(), ended: pipe.input.readableEnded }),
      ),
  );
  expect(observed).toEqual({ bytes, ended: false });
  await pipe.drained;
  expect(pipe.read()).toEqual(bytes);
});

test.each(Array.from({ length: end.length - 1 }, (_, index) => index + 1))(
  'a marker split at byte %i drains preceding bytes and is removed from the log',
  async (split) => {
    const bytes = Buffer.from([0xff, 0x00, 0x05, 0x0a, 0x61]);
    const pipe = await output(
      Buffer.concat([bytes, end]),
      bytes.length + split,
    );
    await pipe.drained;
    expect(pipe.read()).toEqual(bytes);
  },
);

test('only this launch marker completes shutdown and foreign markers remain output', async () => {
  const foreign = Buffer.from('\0Porcelain output complete: another-launch\0');
  const pipe = await output(Buffer.concat([foreign, end]), foreign.length);
  let completed = false;
  void pipe.drained.then(() => {
    completed = true;
  });
  await new Promise<void>((resolve) =>
    pipe.input.once('data', () => resolve()),
  );
  expect(completed).toBe(false);
  await pipe.drained;
  expect(pipe.read()).toEqual(foreign);
});

test('premature EOF preserves a partial prefix and rejects missing shutdown output', async () => {
  const bytes = Buffer.from('output\0Porcelain output comp');
  const pipe = await output(bytes);
  await expect(pipe.drained).rejects.toThrow(
    'The server output ended without its shutdown marker',
  );
  expect(pipe.read()).toEqual(bytes);
});

test('missing and broken pipes cannot acknowledge shutdown', async () => {
  await expect(drainServerOutput(null, token, () => undefined)).rejects.toThrow(
    'The server output pipe is missing',
  );
  const folder = await mkdtemp(join(tmpdir(), 'porcelain-broken-output-'));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  const input = createReadStream(join(folder, 'missing'));
  await expect(
    drainServerOutput(input, token, () => undefined),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});

test('real process pipes complete before child exit and preserve the literal shutdown line', async () => {
  const adapter = new URL('./server-output.ts', import.meta.url).href;
  const source = `
    process.stdin.on('data', () => process.exit(0));
    const { finishServerOutput } = await import(${JSON.stringify(adapter)});
    process.stdout.write('x'.repeat(131072));
    process.stderr.write('diagnostic\\n');
    await finishServerOutput(${JSON.stringify(token)});
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const pid = child.pid;
  if (pid === undefined) throw new Error('The output probe did not start');
  console.info(`Server output probe PID ${pid}`);
  onTestFinished(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  });
  const closed = new Promise<{ code: number | null; signal: string | null }>(
    (resolve) =>
      child.once('close', (code, signal) => resolve({ code, signal })),
  );
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  await Promise.all([
    drainServerOutput(child.stdout, token, (chunk) => stdout.push(chunk)),
    drainServerOutput(child.stderr, token, (chunk) => stderr.push(chunk)),
  ]);
  expect(child.exitCode).toBe(null);
  expect(Buffer.concat(stdout).toString()).toBe('x'.repeat(131072));
  expect(Buffer.concat(stderr).toString()).toBe(
    'diagnostic\nPorcelain server: closed\n',
  );
  child.stdin.end('exit');
  expect(await closed).toEqual({ code: 0, signal: null });
});
