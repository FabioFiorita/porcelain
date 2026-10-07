import type { SetRemoteAccessRequest } from '@porcelain/contracts/access';
import { Context, Effect, Exit, Layer, Option, Ref } from 'effect';
import { AsyncResult, Atom, AtomRegistry } from 'effect/reactivity';
import { porcelainClient } from '../../../shared/api/client.ts';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { accessRuntime, AccessSnapshots } from '../store/share.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { WriteQueues } from '../../../shared/api/write-queue.ts';
import {
  readPairedAccess,
  readRemoteAccess,
  readServiceUpdate,
} from '../queries/share.ts';
import { issuedLink } from '../rules/share.ts';

function makeAccessCommands(connection: RuntimeConnection) {
  return Effect.gen(function* () {
    const client = yield* porcelainClient(connection);
    const queues = yield* WriteQueues;
    const snapshots = yield* AccessSnapshots;
    const registry = yield* AtomRegistry.AtomRegistry;
    function run<A, E, R>(key: string, operation: Effect.Effect<A, E, R>) {
      return queues.run(
        [key],
        Effect.gen(function* () {
          yield* currentAnswerEffect(connection.request().signal);
          const answer = yield* operation;
          yield* currentAnswerEffect(connection.request().signal);
          return answer;
        }),
      );
    }
    function refresh<A>(atom: Atom.Atom<A>) {
      return Effect.sync(() => {
        if (!connection.request().signal.aborted) registry.refresh(atom);
      });
    }
    function confirm<A, E, F, R>(
      state: Atom.Writable<
        AsyncResult.AsyncResult<A, E>,
        Atom.Atom<
          AsyncResult.AsyncResult<AsyncResult.AsyncResult<A, E>, unknown>
        >
      >,
      snapshot: Ref.Ref<Option.Option<A>>,
      operation: Effect.Effect<A, F, R>,
    ) {
      return Effect.acquireUseRelease(
        Effect.sync(() => {
          const unmount = registry.mount(state);
          const transition = Atom.make<
            AsyncResult.AsyncResult<AsyncResult.AsyncResult<A, E>, unknown>
          >(AsyncResult.success(registry.get(state), { waiting: true }));
          registry.set(state, transition);
          return { transition, unmount };
        }),
        ({ transition }) =>
          operation.pipe(
            Effect.tap((answer) =>
              Effect.gen(function* () {
                yield* Ref.set(snapshot, Option.some(answer));
                registry.set(
                  transition,
                  AsyncResult.success(AsyncResult.success<A, E>(answer), {
                    waiting: true,
                  }),
                );
              }),
            ),
          ),
        ({ transition, unmount }, exit) =>
          Effect.sync(() => {
            registry.set(
              transition,
              Exit.isSuccess(exit)
                ? AsyncResult.success(AsyncResult.success<A, E>(exit.value))
                : AsyncResult.failure(exit.cause),
            );
            unmount();
          }),
      );
    }
    return {
      issue: (input: {
        label: string;
        addresses: string[];
        trusted: boolean;
      }) =>
        run(
          'paired-access',
          client
            .request((api) =>
              api.administration.issuePairing({
                payload: {
                  labels: [input.label],
                  addresses: input.addresses,
                  ...(input.trusted ? { trusted: true } : {}),
                },
              }),
            )
            .pipe(Effect.tap(() => refresh(readPairedAccess(connection)))),
        ),
      revoke: (id: string) =>
        run(
          'paired-access',
          client
            .request((api) =>
              api.administration.revokeAccess({ payload: { id } }),
            )
            .pipe(Effect.ensuring(refresh(readPairedAccess(connection)))),
        ),
      trust: (input: { id: string; trusted: boolean }) =>
        run(
          'paired-access',
          client
            .request((api) =>
              api.administration.setDeviceTrust({ payload: input }),
            )
            .pipe(Effect.ensuring(refresh(readPairedAccess(connection)))),
        ),
      setRemote: (change: SetRemoteAccessRequest) =>
        run(
          'remote-access',
          confirm(
            readRemoteAccess(connection),
            snapshots.remote,
            client
              .request((api) =>
                api.administration.setRemoteAccess({ payload: change }),
              )
              .pipe(
                Effect.tap(() =>
                  currentAnswerEffect(connection.request().signal),
                ),
              ),
          ),
        ),
      startUpdate: (version: string) =>
        run(
          'service-update',
          confirm(
            readServiceUpdate(connection),
            snapshots.update,
            client
              .request((api) =>
                api.serviceUpdates.startServiceUpdate({ payload: { version } }),
              )
              .pipe(
                Effect.tap(() =>
                  currentAnswerEffect(connection.request().signal),
                ),
                Effect.tapError(() => refresh(readServiceUpdate(connection))),
              ),
          ),
        ),
    };
  });
}

class AccessCommands extends Context.Service<
  AccessCommands,
  Effect.Success<ReturnType<typeof makeAccessCommands>>
>()('@porcelain/client/AccessCommands') {
  static layer(connection: RuntimeConnection) {
    return Layer.effect(AccessCommands, makeAccessCommands(connection));
  }
}

const accessCommandRuntime = Atom.family((connection: RuntimeConnection) =>
  connection.atoms((get) =>
    Layer.provideMerge(
      AccessCommands.layer(connection),
      get(accessRuntime(connection).layer),
    ),
  ),
);

export const issuePairing = Atom.family((connection: RuntimeConnection) =>
  accessCommandRuntime(connection).fn(
    (input: { label: string; addresses: string[]; trusted: boolean }) =>
      AccessCommands.use((commands) => commands.issue(input)).pipe(
        Effect.map(issuedLink),
      ),
    { concurrent: true },
  ),
);
export const revokeAccess = Atom.family(
  ({ connection, id }: { connection: RuntimeConnection; id: string }) =>
    accessCommandRuntime(connection).fn(
      () => AccessCommands.use((commands) => commands.revoke(id)),
      { concurrent: true },
    ),
);
export const setDeviceTrust = Atom.family(
  ({ connection, id }: { connection: RuntimeConnection; id: string }) =>
    accessCommandRuntime(connection).fn(
      (trusted: boolean) =>
        AccessCommands.use((commands) => commands.trust({ id, trusted })),
      { concurrent: true },
    ),
);
export const setRemoteAccess = Atom.family((connection: RuntimeConnection) =>
  accessCommandRuntime(connection).fn(
    (change: SetRemoteAccessRequest) =>
      AccessCommands.use((commands) => commands.setRemote(change)),
    { concurrent: true },
  ),
);
export const startServiceUpdate = Atom.family((connection: RuntimeConnection) =>
  accessCommandRuntime(connection).fn(
    (version: string) =>
      AccessCommands.use((commands) => commands.startUpdate(version)),
    { concurrent: true },
  ),
);
