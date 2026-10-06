import { Effect, Layer, Scope } from 'effect';
import { AccessStore } from '../store.ts';
import { RemoteConnections } from '../store/remote-connections.ts';

export const remoteConnectionsLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const access = yield* AccessStore;
    const connections = yield* RemoteConnections;
    const scope = yield* Scope.Scope;
    const context = yield* Effect.context<never>();
    yield* connections.synchronize(access.state.value.remotes);
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        access.state.subscribe(({ remotes }) => {
          Effect.runForkWith(context)(
            connections.synchronize(remotes).pipe(Effect.forkIn(scope)),
          );
        }),
      ),
      (unsubscribe) => Effect.sync(unsubscribe),
    );
  }),
);
