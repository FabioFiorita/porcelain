import { NodeFileSystem } from '@effect/platform-node';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { expect, it } from '@effect/vitest';
import { Effect, FileSystem } from 'effect';
import { join } from 'node:path';
import { openServerLog } from './server-log.ts';

const fixture = Effect.gen(function* () {
  const folder = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped({
    prefix: 'porcelain-desktop-persistence-',
  });
  return { directory: join(folder, 'logs') };
});

it.effect('keeps server writes in order in a folder it creates', () =>
  Effect.gen(function* () {
    const { directory } = yield* fixture;
    const log = yield* openServerLog(directory, 64);
    yield* log.append(Buffer.from('listening\n'));
    yield* log.append(Buffer.from('ready\n'));
    yield* log.flush();
    expect(
      yield* Effect.tryPromise(() =>
        readFile(join(directory, 'server.log'), 'utf8'),
      ),
    ).toBe('listening\nready\n');
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('rotates a full log and keeps at most twice the limit', () =>
  Effect.gen(function* () {
    const { directory } = yield* fixture;
    const log = yield* openServerLog(directory, 10);
    for (const value of ['aaaaaaaa\n', 'bbbbbbbb\n', 'cccccccc\n'])
      yield* log.append(Buffer.from(value));
    yield* log.flush();
    expect(yield* Effect.tryPromise(() => readdir(directory))).toEqual([
      'server.log',
      'server.log.1',
    ]);
    expect(
      yield* Effect.tryPromise(() =>
        readFile(join(directory, 'server.log.1'), 'utf8'),
      ),
    ).toBe('bbbbbbbb\n');
    expect(
      yield* Effect.tryPromise(() =>
        readFile(join(directory, 'server.log'), 'utf8'),
      ),
    ).toBe('cccccccc\n');
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('keeps only the end of a write larger than the limit', () =>
  Effect.gen(function* () {
    const { directory } = yield* fixture;
    const log = yield* openServerLog(directory, 4);
    yield* log.append(Buffer.from('0123456789'));
    yield* log.flush();
    expect(
      yield* Effect.tryPromise(() =>
        readFile(join(directory, 'server.log'), 'utf8'),
      ),
    ).toBe('6789');
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('counts the previous launch log toward rotation', () =>
  Effect.gen(function* () {
    const { directory } = yield* fixture;
    const earlier = yield* openServerLog(directory, 10);
    yield* earlier.append(Buffer.from('before\n'));
    yield* earlier.flush();
    const log = yield* openServerLog(directory, 10);
    yield* log.append(Buffer.from('after\n'));
    yield* log.flush();
    expect(
      yield* Effect.tryPromise(() =>
        readFile(join(directory, 'server.log.1'), 'utf8'),
      ),
    ).toBe('before\n');
    expect(
      yield* Effect.tryPromise(() =>
        readFile(join(directory, 'server.log'), 'utf8'),
      ),
    ).toBe('after\n');
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('keeps writing after a filesystem failure', () =>
  Effect.gen(function* () {
    const { directory } = yield* fixture;
    yield* Effect.tryPromise(() =>
      writeFile(directory, 'a file where the folder belongs'),
    );
    const log = yield* openServerLog(directory, 64);
    yield* log.append(Buffer.from('lost\n'));
    yield* log.flush();
    yield* Effect.tryPromise(() => rm(directory));
    yield* log.append(Buffer.from('kept\n'));
    yield* log.flush();
    expect(
      yield* Effect.tryPromise(() =>
        readFile(join(directory, 'server.log'), 'utf8'),
      ),
    ).toBe('kept\n');
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect(
  'scope closure drains queued log writes without an explicit flush',
  () =>
    Effect.gen(function* () {
      const { directory } = yield* fixture;
      yield* Effect.gen(function* () {
        const log = yield* openServerLog(directory, 64);
        yield* log.append(Buffer.from('last output\n'));
      }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer));
      expect(
        yield* Effect.tryPromise(() =>
          readFile(join(directory, 'server.log'), 'utf8'),
        ),
      ).toBe('last output\n');
    }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);
