import { it, expect } from '@effect/vitest';
import { Effect, Fiber, FileSystem } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { constants } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import {
  openGuardedFile,
  openRawDirectory,
  syscall,
} from './guarded-filesystem-syscalls.ts';

it.effect(
  'opens a real file without following a symbolic link and preserves raw directory names',
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(`${root}/source`, 'guarded contents');
      yield* fs.symlink(`${root}/source`, `${root}/link`);
      const rejected = yield* Effect.scoped(
        openGuardedFile(`${root}/link`, constants.O_RDONLY),
      ).pipe(Effect.result);
      expect(rejected._tag).toBe('Failure');
      const file = yield* openGuardedFile(`${root}/source`, constants.O_RDONLY);
      expect(yield* syscall(() => file.readFile({ encoding: 'utf8' }))).toBe(
        'guarded contents',
      );
      const rawName =
        process.platform === 'linux'
          ? Buffer.from([0xff])
          : Buffer.from('raw-name');
      const raw = Buffer.concat([Buffer.from(`${root}/`), rawName]);
      yield* Effect.promise(() => writeFile(raw, 'raw'));
      const directory = yield* openRawDirectory(root);
      const names: (string | Buffer)[] = [];
      for (;;) {
        const entry = yield* syscall(() => directory.read());
        if (entry === null) break;
        names.push(entry.name);
      }
      expect(names.every((name) => Buffer.isBuffer(name))).toBe(true);
      expect(
        names.some((name) => Buffer.isBuffer(name) && name.equals(rawName)),
      ).toBe(true);
    }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect(
  'interruption waits for a pending syscall before releasing its file handle',
  () =>
    Effect.gen(function* () {
      const pending = Promise.withResolvers<string>();
      const entered = Promise.withResolvers<void>();
      let closed = false;
      const worker = yield* Effect.forkChild(
        Effect.scoped(
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                closed = true;
              }),
            );
            return yield* syscall(() => {
              entered.resolve();
              return pending.promise;
            });
          }),
        ),
      );
      yield* Effect.promise(() => entered.promise);
      const stopping = yield* Effect.forkChild(Fiber.interrupt(worker));
      yield* Effect.yieldNow;
      expect(closed).toBe(false);
      expect(stopping.pollUnsafe()).toBeUndefined();
      pending.resolve('finished');
      yield* Fiber.join(stopping);
      expect(closed).toBe(true);
    }),
);
