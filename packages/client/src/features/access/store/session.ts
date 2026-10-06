import { Context, Effect, Exit, Layer, Scope } from 'effect';
import { AtomRef } from 'effect/reactivity';
import type { BrowserSession } from '../rules/browser-session.ts';
import {
  ConnectionFactory,
  type EnvironmentConnection,
} from '../ports/connection-factory.ts';

type SessionState = {
  readonly connection: EnvironmentConnection | null;
  readonly generation: number;
  readonly writerIdentity: string | undefined;
};

type CompleteConnection = (session: BrowserSession) => Effect.Effect<boolean>;

export class AccessSession extends Context.Service<
  AccessSession,
  {
    readonly state: AtomRef.ReadonlyRef<SessionState>;
    readonly beginConnection: (
      automatic?: boolean,
    ) => Effect.Effect<CompleteConnection | null>;
    readonly clear: () => Effect.Effect<void>;
  }
>()('@porcelain/client/AccessSession') {
  static readonly layer = Layer.effect(
    AccessSession,
    Effect.gen(function* () {
      const factory = yield* ConnectionFactory;
      const scope = yield* Scope.Scope;
      let currentScope: Scope.Closeable | undefined;
      const state = AtomRef.make<SessionState>({
        connection: null,
        generation: 0,
        writerIdentity: undefined,
      });
      return {
        state,
        beginConnection: Effect.fn('AccessSession.beginConnection')(
          (automatic = false) =>
            Effect.sync(() => {
              if (automatic && state.value.generation !== 0) return null;
              const attempt = state.value.generation;
              return Effect.fn('AccessSession.completeConnection')(function* (
                session: BrowserSession,
              ) {
                if (attempt !== state.value.generation) return false;
                const writerIdentity = JSON.stringify(session.principal);
                const kept =
                  state.value.connection?.environmentId ===
                    session.inventory.environmentId &&
                  state.value.writerIdentity === writerIdentity;
                let connectionScope = currentScope;
                let connection = state.value.connection;
                if (!kept) {
                  connectionScope = yield* Scope.fork(scope, 'sequential');
                  connection = yield* factory
                    .local(session)
                    .pipe(Effect.provideService(Scope.Scope, connectionScope));
                }
                if (attempt !== state.value.generation) {
                  if (!kept && connectionScope)
                    yield* Scope.close(connectionScope, Exit.void);
                  return false;
                }
                const previous = currentScope;
                currentScope = connectionScope;
                state.update((current) => ({
                  ...current,
                  connection,
                  writerIdentity,
                  generation: attempt + 1,
                }));
                if (previous && previous !== currentScope)
                  yield* Scope.close(previous, Exit.void);
                return true;
              }, Effect.uninterruptible);
            }),
        ),
        clear: Effect.fn('AccessSession.clear')(function* () {
          const previous = currentScope;
          currentScope = undefined;
          state.update((current) => ({
            ...current,
            connection: null,
            writerIdentity: undefined,
            generation: current.generation + 1,
          }));
          if (previous) yield* Scope.close(previous, Exit.void);
        }, Effect.uninterruptible),
      };
    }),
  );
}
