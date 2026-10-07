import { join } from 'node:path';
import { Deferred, Effect, FileSystem, Queue, Stream } from 'effect';

type Write = { chunk: Buffer } | { barrier: Deferred.Deferred<void> };

export const openServerLog = Effect.fn('openServerLog')(function* (
  directory: string,
  limitBytes: number,
) {
  const fs = yield* FileSystem.FileSystem;
  const queue = yield* Queue.make<Write>();
  let size: number | undefined;
  const write = Effect.fn('ServerLog.write')(
    function* (chunk: Buffer) {
      const current = join(directory, 'server.log');
      if (size === undefined) {
        yield* fs.makeDirectory(directory, { recursive: true });
        size = yield* fs.stat(current).pipe(
          Effect.map((file) => Number(file.size)),
          Effect.catch(() => Effect.succeed(0)),
        );
      }
      const kept = chunk.subarray(Math.max(0, chunk.length - limitBytes));
      if (size > 0 && size + kept.length > limitBytes) {
        yield* fs.rename(current, join(directory, 'server.log.1'));
        size = 0;
      }
      yield* fs.writeFile(current, kept, { flag: 'a', mode: 0o600 });
      size += kept.length;
    },
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(
          `Porcelain: server log not written: ${error.message}\n`,
        );
      }),
    ),
  );
  yield* Stream.fromQueue(queue).pipe(
    Stream.runForEach((entry) =>
      'chunk' in entry
        ? write(entry.chunk)
        : Deferred.succeed(entry.barrier, undefined),
    ),
    Effect.forkScoped,
  );
  const append = Effect.fn('ServerLog.append')((chunk: Buffer) =>
    Queue.offer(queue, { chunk }).pipe(Effect.asVoid),
  );
  const flush = Effect.fn('ServerLog.flush')(function* () {
    const barrier = yield* Deferred.make<void>();
    yield* Queue.offer(queue, { barrier });
    yield* Deferred.await(barrier);
  });
  yield* Effect.addFinalizer(() =>
    flush().pipe(Effect.ensuring(Queue.shutdown(queue))),
  );
  return { append, flush };
});
