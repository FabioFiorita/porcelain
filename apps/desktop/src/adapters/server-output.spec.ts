import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from '@effect/vitest';
import { Deferred, Effect, Fiber } from 'effect';
import { drainServerOutput } from './server-output.ts';

const token = '7dc5785f-833e-48c8-a0be-7c10a36093fb';
const end = Buffer.from(`\0Porcelain output complete: ${token}\0`);

const output = Effect.fn('output')(function* (
  bytes: Buffer,
  highWaterMark?: number,
) {
  const folder = yield* Effect.acquireRelease(
    Effect.tryPromise(() =>
      mkdtemp(join(tmpdir(), 'porcelain-desktop-output-')),
    ),
    (folder) =>
      Effect.tryPromise(() =>
        rm(folder, { recursive: true, force: true }),
      ).pipe(Effect.orDie),
  );
  const file = join(folder, 'output');
  yield* Effect.tryPromise(() => writeFile(file, bytes));
  const input = yield* Effect.acquireRelease(
    Effect.sync(() => createReadStream(file, { highWaterMark })),
    (input) =>
      Effect.sync(() => {
        input.destroy();
      }),
  );
  const chunks: Buffer[] = [];
  const observed = yield* Deferred.make<{ bytes: Buffer; ended: boolean }>();
  const drained = yield* drainServerOutput(input, token, (chunk) =>
    Effect.sync(() => {
      chunks.push(chunk);
    }).pipe(
      Effect.andThen(
        Deferred.succeed(observed, {
          bytes: chunk,
          ended: input.readableEnded,
        }),
      ),
      Effect.asVoid,
    ),
  ).pipe(Effect.forkScoped);
  return { input, drained, observed, read: () => Buffer.concat(chunks) };
});

it.effect(
  'ordinary output is available before shutdown without waiting for a line or EOF',
  () =>
    Effect.gen(function* () {
      const bytes = Buffer.from('ordinary output without a newline');
      const pipe = yield* output(Buffer.concat([bytes, end]), bytes.length);
      expect(yield* Deferred.await(pipe.observed)).toEqual({
        bytes,
        ended: false,
      });
      yield* Fiber.join(pipe.drained);
      expect(pipe.read()).toEqual(bytes);
    }).pipe(Effect.scoped),
);

it.effect(
  'removes shutdown markers split at every byte boundary and preserves exact output',
  () =>
    Effect.gen(function* () {
      const bytes = Buffer.from([0xff, 0x00, 0x05, 0x0a, 0x61]);
      const splits = Array.from(
        { length: end.length - 1 },
        (_, index) => index + 1,
      );
      const actual = yield* Effect.forEach(
        splits,
        Effect.fn(function* (split) {
          const pipe = yield* output(
            Buffer.concat([bytes, end]),
            bytes.length + split,
          );
          yield* Fiber.join(pipe.drained);
          return pipe.read();
        }),
      );
      expect(actual).toEqual(splits.map(() => bytes));
    }).pipe(Effect.scoped),
);

it.effect('foreign markers remain output and cannot acknowledge shutdown', () =>
  Effect.gen(function* () {
    const foreign = Buffer.from(
      '\0Porcelain output complete: another-launch\0',
    );
    const pipe = yield* output(foreign);
    expect(yield* Effect.flip(Fiber.join(pipe.drained))).toMatchObject({
      message: 'The server output ended without its shutdown marker',
    });
    expect(pipe.read()).toEqual(foreign);
  }).pipe(Effect.scoped),
);

it.effect(
  'premature EOF preserves a partial prefix and rejects missing shutdown output',
  () =>
    Effect.gen(function* () {
      const bytes = Buffer.from('output\0Porcelain output comp');
      const pipe = yield* output(bytes);
      expect(yield* Effect.flip(Fiber.join(pipe.drained))).toMatchObject({
        message: 'The server output ended without its shutdown marker',
      });
      expect(pipe.read()).toEqual(bytes);
    }).pipe(Effect.scoped),
);

it.effect('missing and broken pipes cannot acknowledge shutdown', () =>
  Effect.gen(function* () {
    expect(
      yield* Effect.flip(drainServerOutput(null, token, () => Effect.void)),
    ).toMatchObject({ message: 'The server output pipe is missing' });
    const folder = yield* Effect.acquireRelease(
      Effect.tryPromise(() =>
        mkdtemp(join(tmpdir(), 'porcelain-desktop-output-')),
      ),
      (folder) =>
        Effect.tryPromise(() =>
          rm(folder, { recursive: true, force: true }),
        ).pipe(Effect.orDie),
    );
    const input = yield* Effect.acquireRelease(
      Effect.sync(() => createReadStream(join(folder, 'missing'))),
      (input) =>
        Effect.sync(() => {
          input.destroy();
        }),
    );
    expect(
      yield* Effect.flip(drainServerOutput(input, token, () => Effect.void)),
    ).toMatchObject({ cause: { code: 'ENOENT' } });
  }).pipe(Effect.scoped),
);

it.effect(
  'real process pipes complete before exit and preserve the literal shutdown line',
  () =>
    Effect.gen(function* () {
      const adapter = new URL('./server-output.ts', import.meta.url).href;
      const source = `
    process.stdin.on('data', () => process.exit(0));
    const { Effect } = await import('effect');
    const { finishServerOutput } = await import(${JSON.stringify(adapter)});
    process.stdout.write('x'.repeat(131072));
    process.stderr.write('diagnostic\\n');
    await Effect.runPromise(finishServerOutput(${JSON.stringify(token)}));
  `;
      const child = yield* Effect.acquireRelease(
        Effect.sync(() =>
          spawn(process.execPath, ['--input-type=module', '-e', source], {
            stdio: ['pipe', 'pipe', 'pipe'],
          }),
        ),
        (child) =>
          Effect.sync(() => {
            if (child.exitCode === null && child.signalCode === null)
              child.kill();
          }),
      );
      if (child.pid === undefined)
        return yield* Effect.die(new Error('The output probe did not start'));
      console.info(`Server output probe PID ${child.pid}`);
      const closed = yield* Deferred.make<{
        code: number | null;
        signal: string | null;
      }>();
      child.once('close', (code, signal) => {
        Deferred.doneUnsafe(closed, Effect.succeed({ code, signal }));
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      yield* Effect.all(
        [
          drainServerOutput(child.stdout, token, (chunk) =>
            Effect.sync(() => {
              stdout.push(chunk);
            }),
          ),
          drainServerOutput(child.stderr, token, (chunk) =>
            Effect.sync(() => {
              stderr.push(chunk);
            }),
          ),
        ],
        { concurrency: 'unbounded' },
      );
      expect(child.exitCode).toBe(null);
      expect(Buffer.concat(stdout).toString()).toBe('x'.repeat(131072));
      expect(Buffer.concat(stderr).toString()).toBe(
        'diagnostic\nPorcelain server: closed\n',
      );
      child.stdin.end('exit');
      expect(yield* Deferred.await(closed)).toEqual({ code: 0, signal: null });
    }),
);
