import {
  Cause,
  Effect,
  FileSystem,
  Option,
  Queue,
  Deferred,
  Schema,
} from 'effect';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  desktopWindowStateSchema,
  type DesktopWindowState,
} from '@porcelain/contracts/desktop';

type Save =
  | { state: DesktopWindowState }
  | { barrier: Deferred.Deferred<void> };

export const openWindowState = Effect.fn('openWindowState')(function* (
  profile: string,
  delayMs: number,
) {
  const fs = yield* FileSystem.FileSystem;
  const queue = yield* Queue.make<Save>();
  const destination = join(profile, 'window.json');
  let latest: DesktopWindowState | undefined;
  const read = Effect.fn('WindowState.read')(() =>
    fs.readFileString(destination).pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(
          Schema.fromJsonString(desktopWindowStateSchema),
        ),
      ),
      Effect.catch(() => Effect.succeed(undefined)),
    ),
  );
  const write = Effect.fn('WindowState.write')(
    function* () {
      const state = latest;
      latest = undefined;
      if (state === undefined) return;
      yield* fs.makeDirectory(profile, { recursive: true });
      const temporary = `${destination}.${randomUUID()}.tmp`;
      yield* fs
        .writeFileString(temporary, JSON.stringify(state))
        .pipe(
          Effect.andThen(fs.rename(temporary, destination)),
          Effect.ensuring(
            fs.remove(temporary, { force: true }).pipe(Effect.orDie),
          ),
        );
    },
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        const error = Cause.squash(cause);
        process.stderr.write(
          `Porcelain: window state not saved: ${error instanceof Error ? error.message : Cause.pretty(cause)}\n`,
        );
      }),
    ),
  );
  yield* Effect.gen(function* () {
    while (true) {
      const entry = yield* latest === undefined
        ? Queue.take(queue).pipe(Effect.map(Option.some))
        : Queue.take(queue).pipe(Effect.timeoutOption(delayMs));
      if (Option.isNone(entry)) yield* write();
      else if ('state' in entry.value) latest = entry.value.state;
      else {
        yield* write();
        yield* Deferred.succeed(entry.value.barrier, undefined);
      }
    }
  }).pipe(Effect.forkScoped);
  const schedule = Effect.fn('WindowState.schedule')(
    (state: DesktopWindowState) =>
      Queue.offer(queue, { state }).pipe(Effect.asVoid),
  );
  const flush = Effect.fn('WindowState.flush')(function* () {
    const barrier = yield* Deferred.make<void>();
    yield* Queue.offer(queue, { barrier });
    yield* Deferred.await(barrier);
  });
  yield* Effect.addFinalizer(() =>
    flush().pipe(Effect.ensuring(Queue.shutdown(queue))),
  );
  return { read, schedule, flush };
});
