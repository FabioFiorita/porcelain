import { Cause, Data, Deferred, Effect, Queue, Stream } from 'effect';

class ServerOutputError extends Data.TaggedError('ServerOutputError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

function marker(token: string): Buffer {
  return Buffer.from(`\0Porcelain output complete: ${token}\0`);
}

export const finishServerOutput = Effect.fn('finishServerOutput')(function* (
  token: string,
) {
  const end = marker(token);
  yield* Effect.all(
    [
      Effect.callback<void>((resume) => {
        process.stdout.end(end, () => resume(Effect.void));
      }),
      Effect.callback<void>((resume) => {
        process.stderr.end(
          Buffer.concat([Buffer.from('Porcelain server: closed\n'), end]),
          () => resume(Effect.void),
        );
      }),
    ],
    { concurrency: 'unbounded' },
  );
});

export const drainServerOutput = Effect.fn('drainServerOutput')(function* (
  input: NodeJS.ReadableStream | null,
  token: string,
  accept: (chunk: Buffer) => Effect.Effect<void>,
) {
  if (input === null)
    return yield* Effect.fail(
      new ServerOutputError({ message: 'The server output pipe is missing' }),
    );
  const end = marker(token);
  let pending = Buffer.alloc(0);
  let completed = false;
  const drained = yield* Deferred.make<void, ServerOutputError>();
  const emit = Effect.fn('ServerOutput.emit')((chunk: Buffer) =>
    chunk.length > 0 ? accept(chunk) : Effect.void,
  );
  const stream = Stream.callback<Buffer, ServerOutputError>(
    Effect.fn(function* (queue) {
      const data = (chunk: Buffer) => {
        Queue.offerUnsafe(queue, chunk);
      };
      const error = (cause: unknown) => {
        Queue.failCauseUnsafe(
          queue,
          Cause.fail(
            new ServerOutputError({
              message:
                cause instanceof Error
                  ? cause.message
                  : 'The server output pipe failed',
              cause,
            }),
          ),
        );
      };
      const ended = () => {
        Queue.endUnsafe(queue);
      };
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          input.on('data', data);
          input.once('error', error);
          input.once('end', ended);
        }),
        () =>
          Effect.sync(() => {
            input.removeListener('data', data);
            input.removeListener('error', error);
            input.removeListener('end', ended);
          }),
      );
    }),
  );
  yield* stream.pipe(
    Stream.runForEach(
      Effect.fn(function* (chunk) {
        if (completed) return yield* emit(chunk);
        const buffered = Buffer.concat([pending, chunk]);
        const position = buffered.indexOf(end);
        if (position !== -1) {
          yield* emit(buffered.subarray(0, position));
          yield* emit(buffered.subarray(position + end.length));
          pending = Buffer.alloc(0);
          completed = true;
          yield* Deferred.succeed(drained, undefined);
          return;
        }
        const start = buffered.lastIndexOf(0);
        const tail = buffered.subarray(start);
        pending =
          start !== -1 &&
          tail.length < end.length &&
          end.subarray(0, tail.length).equals(tail)
            ? tail
            : Buffer.alloc(0);
        yield* emit(buffered.subarray(0, buffered.length - pending.length));
      }),
    ),
    Effect.andThen(
      Effect.gen(function* () {
        if (!completed) {
          yield* emit(pending);
          yield* Deferred.fail(
            drained,
            new ServerOutputError({
              message: 'The server output ended without its shutdown marker',
            }),
          );
        }
      }),
    ),
    Effect.catch((error) => Deferred.fail(drained, error)),
    Effect.forkScoped({ startImmediately: true }),
  );
  return yield* Deferred.await(drained);
});
