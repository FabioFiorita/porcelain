import { Effect, Layer, Queue, Stream } from 'effect';
import type { Remote } from '../rules/remotes.ts';
import { AccessStore } from '../store.ts';
import { RemoteConnections } from '../store/remote-connections.ts';

export const remoteConnectionsLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const access = yield* AccessStore;
    const connections = yield* RemoteConnections;
    yield* connections.synchronize(access.state.value.remotes);
    const changes = Stream.callback<readonly Remote[]>(
      Effect.fn('RemoteConnections.subscribe')(function* (queue) {
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            access.state.subscribe(({ remotes }) => {
              Queue.offerUnsafe(queue, remotes);
            }),
          ),
          (unsubscribe) => Effect.sync(unsubscribe),
        );
      }),
    );
    yield* changes.pipe(
      Stream.runForEach(connections.synchronize),
      Effect.forkScoped({ startImmediately: true }),
    );
  }),
);
