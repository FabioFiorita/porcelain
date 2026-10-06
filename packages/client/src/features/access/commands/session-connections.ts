import { Effect, Layer, Scope } from 'effect';
import { AccessStore } from '../store.ts';
import { AccessSession } from '../store/session.ts';

export const sessionConnectionsLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const access = yield* AccessStore;
    const session = yield* AccessSession;
    const scope = yield* Scope.Scope;
    const context = yield* Effect.context<never>();
    yield* session.synchronize(access.state.value.remotes);
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        access.state.subscribe(({ remotes }) => {
          Effect.runForkWith(context)(
            session.synchronize(remotes).pipe(Effect.forkIn(scope)),
          );
        }),
      ),
      (unsubscribe) => Effect.sync(unsubscribe),
    );
  }),
);
