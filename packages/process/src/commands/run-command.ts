import { Clock, Deferred, Duration, Effect, Fiber, Ref, Stream } from 'effect';
import { ChildProcess } from 'effect/process';

export type ProcessGroupLimits = {
  readonly lingerMs: number;
  readonly cleanupMs: number;
  readonly pollMs: number;
};

type RunCommandInput = {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string | undefined;
  readonly env?: NodeJS.ProcessEnv | undefined;
  readonly stdin?: string | Buffer | undefined;
  readonly timeoutMs?: number | undefined;
  readonly maxBytes: number;
  readonly processGroup: ProcessGroupLimits;
  readonly onStderr?: ((chunk: Buffer) => void) | undefined;
};

type CommandStop = 'deadline' | 'output-limit' | 'lingering';
type Collected = {
  readonly chunks: readonly Uint8Array[];
  readonly bytes: number;
  readonly truncated: boolean;
};

export const runCommand = Effect.fn('Process.runCommand')(function* (
  input: RunCommandInput,
) {
  const requested = yield* Deferred.make<CommandStop>();
  const stopped = yield* Ref.make<CommandStop | undefined>(undefined);
  const empty: Collected = { chunks: [], bytes: 0, truncated: false };
  const stdout = yield* Ref.make(empty);
  const stderr = yield* Ref.make(empty);
  const child = yield* ChildProcess.make(input.command, input.args, {
    cwd: input.cwd,
    env: input.env,
    detached: true,
    killSignal: 'SIGKILL',
    forceKillAfter: Duration.millis(input.processGroup.cleanupMs),
  });
  yield* Effect.forkScoped(
    Deferred.await(requested).pipe(
      Effect.tap((reason) => Ref.set(stopped, reason)),
      Effect.andThen(
        child.kill({
          killSignal: 'SIGKILL',
          forceKillAfter: Duration.millis(input.processGroup.cleanupMs),
        }),
      ),
      Effect.ignore,
    ),
    { startImmediately: true },
  );
  if (input.timeoutMs !== undefined)
    yield* Effect.forkScoped(
      Effect.sleep(Duration.millis(input.timeoutMs)).pipe(
        Effect.andThen(Deferred.succeed(requested, 'deadline')),
      ),
      { startImmediately: true },
    );
  const collect = (
    target: Ref.Ref<Collected>,
    overflow: boolean,
    observe?: (chunk: Buffer) => void,
  ) =>
    Effect.fn('Process.collect')(function* (chunk: Uint8Array) {
      observe?.(Buffer.from(chunk));
      const current = yield* Ref.get(target);
      const room = Math.max(0, input.maxBytes - current.bytes);
      const exceeded = chunk.length > room;
      if (overflow && exceeded)
        yield* Deferred.succeed(requested, 'output-limit');
      const kept = chunk.slice(0, room);
      yield* Ref.set(target, {
        chunks: kept.length ? [...current.chunks, kept] : current.chunks,
        bytes: current.bytes + kept.length,
        truncated: current.truncated || exceeded,
      });
    });
  const readers = yield* Effect.forEach(
    [
      Stream.runForEach(child.stdout, collect(stdout, true)),
      Stream.runForEach(child.stderr, collect(stderr, false, input.onStderr)),
    ],
    (read) => Effect.forkScoped(read, { startImmediately: true }),
  );
  yield* Effect.forkScoped(
    Stream.run(
      input.stdin === undefined
        ? Stream.empty
        : Stream.succeed(Buffer.from(input.stdin)),
      child.stdin,
    ).pipe(Effect.ignore),
    { startImmediately: true },
  );
  const exitCode = yield* child.exitCode.pipe(
    Effect.orElseSucceed(() => undefined),
  );
  if (
    !(yield* groupEnds(
      child.pid,
      input.processGroup.lingerMs,
      input.processGroup,
    ))
  ) {
    yield* Deferred.succeed(requested, 'lingering');
    yield* child
      .kill({
        killSignal: 'SIGKILL',
        forceKillAfter: Duration.millis(input.processGroup.cleanupMs),
      })
      .pipe(Effect.ignore);
  }
  const groupStopped = yield* groupEnds(
    child.pid,
    input.processGroup.cleanupMs,
    input.processGroup,
  );
  const drained = yield* Effect.forEach(readers, Fiber.join).pipe(
    Effect.as(true),
    Effect.timeoutOrElse({
      duration: Duration.millis(input.processGroup.cleanupMs),
      orElse: () => Effect.succeed(false),
    }),
  );
  const collectedOut = yield* Ref.get(stdout);
  const collectedErr = yield* Ref.get(stderr);
  return {
    stdout: Buffer.concat(collectedOut.chunks),
    stderr: Buffer.concat(collectedErr.chunks),
    stderrTruncated: collectedErr.truncated,
    exitCode,
    stopped: yield* Ref.get(stopped),
    groupStopped: groupStopped && drained,
  };
}, Effect.scoped);

const groupEnds = Effect.fn('Process.groupEnds')(function* (
  pid: number,
  withinMs: number,
  limits: ProcessGroupLimits,
) {
  const deadline = (yield* Clock.currentTimeMillis) + withinMs;
  while (groupExists(pid)) {
    if ((yield* Clock.currentTimeMillis) >= deadline) return false;
    yield* Effect.sleep(Duration.millis(limits.pollMs));
  }
  return true;
});

function groupExists(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH')
      return false;
    if (error instanceof Error && 'code' in error && error.code === 'EPERM')
      return true;
    throw error;
  }
}
