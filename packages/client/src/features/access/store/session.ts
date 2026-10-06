import { Context, Effect, Layer } from 'effect';
import { AtomRef } from 'effect/reactivity';
import type { LiveConnection } from '../../live/ports/connection.ts';
import type { BrowserSession } from '../rules/browser-session.ts';
import { syncRemoteConnections, type Remote } from '../rules/remotes.ts';

export type EnvironmentConnection = LiveConnection & {
  readonly address: string;
};

export type RemoteConnection = {
  readonly remote: Remote;
  readonly connection: EnvironmentConnection;
};

type SessionState = {
  readonly connection: EnvironmentConnection | null;
  readonly remoteConnections: readonly RemoteConnection[];
  readonly generation: number;
  readonly writerIdentity: string | undefined;
};

type CompleteConnection = (session: BrowserSession) => Effect.Effect<boolean>;

export class ConnectionFactory extends Context.Service<
  ConnectionFactory,
  {
    readonly local: (session: BrowserSession) => EnvironmentConnection;
    readonly remote: (remote: Remote) => EnvironmentConnection;
  }
>()('@porcelain/client/ConnectionFactory') {}

export class AccessSession extends Context.Service<
  AccessSession,
  {
    readonly state: AtomRef.ReadonlyRef<SessionState>;
    readonly beginConnection: (
      automatic?: boolean,
    ) => Effect.Effect<CompleteConnection | null>;
    readonly clear: () => Effect.Effect<void>;
    readonly synchronize: (remotes: readonly Remote[]) => Effect.Effect<void>;
  }
>()('@porcelain/client/AccessSession') {
  static readonly layer = Layer.effect(
    AccessSession,
    Effect.gen(function* () {
      const factory = yield* ConnectionFactory;
      const owned = new Set<EnvironmentConnection>();
      const releases = new WeakMap<EnvironmentConnection, Promise<void>>();
      const state = AtomRef.make<SessionState>({
        connection: null,
        remoteConnections: [],
        generation: 0,
        writerIdentity: undefined,
      });
      const close = Effect.fn('AccessSession.close')(
        (connection: EnvironmentConnection) =>
          Effect.promise(() => {
            const pending = releases.get(connection);
            if (pending) return pending;
            const release = connection.close();
            releases.set(connection, release);
            return release;
          }).pipe(
            Effect.tap(() => Effect.sync(() => owned.delete(connection))),
            Effect.uninterruptible,
          ),
      );
      yield* Effect.addFinalizer(() =>
        Effect.forEach(owned, close, { discard: true }),
      );
      const synchronize = Effect.fn('AccessSession.synchronize')(function* (
        remotes: readonly Remote[],
      ) {
        const { next, closed } = syncRemoteConnections(
          remotes,
          state.value.remoteConnections,
          factory.remote,
        );
        for (const entry of next) owned.add(entry.connection);
        state.update((current) => ({ ...current, remoteConnections: next }));
        yield* Effect.forEach(closed, close, { discard: true });
      });
      return {
        state,
        synchronize,
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
                const current = state.value.connection;
                const kept =
                  current?.environmentId === session.inventory.environmentId &&
                  state.value.writerIdentity === writerIdentity;
                const connection = kept ? current : factory.local(session);
                owned.add(connection);
                state.update((current) => ({
                  ...current,
                  connection,
                  writerIdentity,
                  generation: attempt + 1,
                }));
                if (current && current !== connection) yield* close(current);
                return true;
              });
            }),
        ),
        clear: Effect.fn('AccessSession.clear')(function* () {
          const connection = state.value.connection;
          state.update((current) => ({
            ...current,
            connection: null,
            writerIdentity: undefined,
            generation: current.generation + 1,
          }));
          if (connection) yield* close(connection);
        }),
      };
    }),
  );
}
