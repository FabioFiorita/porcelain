import { Context, Effect, Exit, Layer, Scope, Semaphore } from 'effect';
import { AtomRef } from 'effect/reactivity';
import {
  RemoteConnectionFactory,
  type RemoteConnection,
} from '../ports/connection-factory.ts';
import { sameRemoteConnection, type Remote } from '../rules/remotes.ts';

export class RemoteConnections extends Context.Service<
  RemoteConnections,
  {
    readonly state: AtomRef.ReadonlyRef<readonly RemoteConnection[]>;
    readonly synchronize: (remotes: readonly Remote[]) => Effect.Effect<void>;
  }
>()('@porcelain/client/RemoteConnections') {
  static readonly layer = Layer.effect(
    RemoteConnections,
    Effect.gen(function* () {
      const factory = yield* RemoteConnectionFactory;
      const scope = yield* Scope.Scope;
      const gate = yield* Semaphore.make(1);
      let owned: readonly (RemoteConnection & {
        readonly scope: Scope.Closeable;
      })[] = [];
      const state = AtomRef.make<readonly RemoteConnection[]>([]);
      return {
        state,
        synchronize: Effect.fn('RemoteConnections.synchronize')(
          (remotes: readonly Remote[]) =>
            Effect.gen(function* () {
              const next = yield* Effect.forEach(remotes, (remote) =>
                Effect.gen(function* () {
                  const kept = owned.find((entry) =>
                    sameRemoteConnection(entry.remote, remote),
                  );
                  if (kept) return { ...kept, remote };
                  const connectionScope = yield* Scope.fork(
                    scope,
                    'sequential',
                  );
                  const connection = yield* factory
                    .open(remote)
                    .pipe(Effect.provideService(Scope.Scope, connectionScope));
                  return { remote, connection, scope: connectionScope };
                }),
              );
              const closed = owned.filter(
                (entry) => !next.some((kept) => kept.scope === entry.scope),
              );
              owned = next;
              state.set(
                next.map(({ remote, connection }) => ({ remote, connection })),
              );
              yield* Effect.forEach(
                closed,
                (entry) => Scope.close(entry.scope, Exit.void),
                { discard: true },
              );
            }).pipe(Semaphore.withPermit(gate), Effect.uninterruptible),
        ),
      };
    }),
  );
}
