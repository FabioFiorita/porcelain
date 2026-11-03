import {
  Deferred,
  type Duration,
  Effect,
  Exit,
  Queue,
  Scope,
  Semaphore,
  Stream,
} from 'effect';
import { ChildProcess, ChildProcessSpawner } from 'effect/process';
import { WorktreeWatchError } from '../../runtime/errors/worktree-watch-error.ts';
import {
  decodeWatchHostMessage,
  type WatchHostEvent,
} from './watch-host-protocol.ts';

export type WatchHostSettings = {
  readonly entry: string;
  readonly heartbeat: Duration.Duration;
  readonly answer: Duration.Duration;
};

export type WatchHostChange = (
  failure: string | undefined,
  events: readonly WatchHostEvent[],
) => void;

type WatchHostSubscription = {
  readonly unsubscribe: Effect.Effect<void, WorktreeWatchError>;
};

export type WatchHost = {
  readonly subscribe: (
    directory: string,
    ignore: readonly string[],
    changed: WatchHostChange,
  ) => Effect.Effect<WatchHostSubscription, WorktreeWatchError>;
};

export const WATCHER_RESTARTED =
  'The file watcher stopped answering and was restarted';

type Watched = {
  readonly directory: string;
  readonly ignore: readonly string[];
  readonly changed: WatchHostChange;
};

type Answer =
  | { readonly kind: 'answered'; readonly failure: string | undefined }
  | { readonly kind: 'lost' };

type Running = {
  readonly scope: Scope.Closeable;
  readonly outbox: Queue.Queue<string>;
  readonly pending: Map<number, Deferred.Deferred<Answer>>;
};

type Request =
  | {
      readonly kind: 'subscribe';
      readonly subscription: number;
      readonly directory: string;
      readonly ignore: readonly string[];
    }
  | { readonly kind: 'unsubscribe'; readonly subscription: number }
  | { readonly kind: 'ping' };

const lost: Answer = { kind: 'lost' };

export const makeWatchHost = Effect.fn('WatchHost.make')(function* (
  settings: WatchHostSettings,
) {
  const parent = yield* Scope.Scope;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const gate = yield* Semaphore.make(1);
  const watched = new Map<number, Watched>();
  const state: {
    running: Running | undefined;
    recovering: boolean;
    closed: boolean;
    nextRequest: number;
    nextSubscription: number;
  } = {
    running: undefined,
    recovering: false,
    closed: false,
    nextRequest: 0,
    nextSubscription: 0,
  };

  const settle = (current: Running) => {
    for (const waiting of current.pending.values())
      Deferred.doneUnsafe(waiting, Exit.succeed(lost));
    current.pending.clear();
  };

  const dispatch = (current: Running, line: string) => {
    const message = decodeWatchHostMessage(line);
    if (message._tag === 'None') return;
    if (message.value.kind === 'events') {
      watched
        .get(message.value.subscription)
        ?.changed(message.value.failure, message.value.events);
      return;
    }
    const waiting = current.pending.get(message.value.request);
    if (!waiting) return;
    current.pending.delete(message.value.request);
    Deferred.doneUnsafe(
      waiting,
      Exit.succeed({ kind: 'answered', failure: message.value.failure }),
    );
  };

  const lose = (current: Running): Effect.Effect<void> =>
    Effect.suspend(() => {
      if (state.running !== current) return Effect.void;
      state.running = undefined;
      state.recovering = true;
      settle(current);
      return Effect.forkIn(
        Scope.close(current.scope, Exit.void).pipe(
          Effect.andThen(ensure),
          Effect.ignore,
        ),
        parent,
        { startImmediately: true },
      ).pipe(Effect.asVoid);
    });

  const ask = (current: Running, request: Request) =>
    Effect.gen(function* () {
      const deadline =
        request.kind === 'ping' ? settings.heartbeat : settings.answer;
      if (state.running !== current) return lost;
      const id = state.nextRequest++;
      const answer = yield* Deferred.make<Answer>();
      current.pending.set(id, answer);
      yield* Queue.offer(
        current.outbox,
        `${JSON.stringify({ ...request, request: id })}\n`,
      );
      return yield* Deferred.await(answer).pipe(
        Effect.timeoutOrElse({
          duration: deadline,
          orElse: () => lose(current).pipe(Effect.as(lost)),
        }),
      );
    });

  const start = Effect.gen(function* () {
    const scope = yield* Scope.fork(parent, 'sequential');
    const outbox = yield* Queue.unbounded<string>();
    const current: Running = { scope, outbox, pending: new Map() };
    const child = yield* ChildProcess.make(process.execPath, [settings.entry], {
      env: { ELECTRON_RUN_AS_NODE: '1' },
      extendEnv: true,
      killSignal: 'SIGKILL',
      stderr: 'inherit',
    }).pipe(
      Effect.provideService(Scope.Scope, scope),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      Effect.mapError((cause) => new WorktreeWatchError({ cause })),
    );
    state.running = current;
    yield* Effect.forkIn(
      Stream.run(
        Stream.fromQueue(outbox).pipe(Stream.map((line) => Buffer.from(line))),
        child.stdin,
      ).pipe(Effect.ignore),
      scope,
      { startImmediately: true },
    );
    yield* Effect.forkIn(
      Stream.runForEach(
        child.stdout.pipe(Stream.decodeText(), Stream.splitLines),
        (line) => Effect.sync(() => dispatch(current, line)),
      ).pipe(Effect.ignore, Effect.andThen(lose(current))),
      parent,
      { startImmediately: true },
    );
    yield* Effect.forkIn(
      Effect.forever(
        Effect.sleep(settings.heartbeat).pipe(
          Effect.andThen(ask(current, { kind: 'ping' })),
        ),
      ),
      scope,
      { startImmediately: true },
    );
    return current;
  });

  const ensure: Effect.Effect<Running, WorktreeWatchError> = gate.withPermit(
    Effect.gen(function* () {
      if (state.closed)
        return yield* new WorktreeWatchError({
          cause: 'The file watcher is shut down',
        });
      if (state.running) return state.running;
      const current = yield* start;
      if (!state.recovering) return current;
      state.recovering = false;
      for (const [subscription, entry] of [...watched]) {
        const answer = yield* ask(current, {
          kind: 'subscribe',
          subscription,
          directory: entry.directory,
          ignore: entry.ignore,
        });
        if (answer.kind === 'lost') return current;
        entry.changed(answer.failure ?? WATCHER_RESTARTED, []);
      }
      return current;
    }),
  );

  yield* Effect.addFinalizer(() =>
    Effect.suspend(() => {
      state.closed = true;
      const current = state.running;
      state.running = undefined;
      if (!current) return Effect.void;
      settle(current);
      return Scope.close(current.scope, Exit.void);
    }),
  );

  return {
    subscribe: Effect.fn('WatchHost.subscribe')(function* (
      directory: string,
      ignore: readonly string[],
      changed: WatchHostChange,
    ) {
      const subscription = state.nextSubscription++;
      watched.set(subscription, { directory, ignore, changed });
      const answer = yield* ensure.pipe(
        Effect.flatMap((current) =>
          ask(current, { kind: 'subscribe', subscription, directory, ignore }),
        ),
        Effect.tapError(() => Effect.sync(() => watched.delete(subscription))),
      );
      if (answer.kind === 'answered' && answer.failure !== undefined) {
        watched.delete(subscription);
        return yield* new WorktreeWatchError({ cause: answer.failure });
      }
      return {
        unsubscribe: Effect.suspend(() => {
          const current = state.running;
          if (!watched.delete(subscription) || !current) return Effect.void;
          return ask(current, { kind: 'unsubscribe', subscription }).pipe(
            Effect.flatMap((result) =>
              result.kind === 'answered' && result.failure !== undefined
                ? Effect.fail(new WorktreeWatchError({ cause: result.failure }))
                : Effect.void,
            ),
          );
        }),
      };
    }),
  } satisfies WatchHost;
});
