import { persistedState } from '../persistence/store.ts';
import { Context, Effect, Layer } from 'effect';
import type { AtomRef } from 'effect/reactivity';
import { ConnectionError } from '../../shared/api/connection-error.ts';
import { type WriteNotSentError } from '../../shared/api/write-queue.ts';
import {
  EnvironmentStorage,
  type EnvironmentSnapshot,
} from './ports/environment-storage.ts';
import {
  withRemote,
  connectionRoutes,
  withConnectionRoutes,
  type Remote,
} from './rules/remotes.ts';
import type { PersistedReadState } from '../persistence/rules/read-state.ts';

type AccessState = PersistedReadState & EnvironmentSnapshot;

type WriteFailure = ConnectionError | WriteNotSentError;

export class AccessStore extends Context.Service<
  AccessStore,
  {
    readonly state: AtomRef.ReadonlyRef<AccessState>;
    readonly load: () => Effect.Effect<void, WriteFailure>;
    readonly save: (remote: Remote) => Effect.Effect<void, WriteFailure>;
    readonly route: (input: {
      readonly environmentId: string;
      readonly address: string;
      readonly kind: 'prefer' | 'remove';
    }) => Effect.Effect<void, WriteFailure>;
    readonly forget: (
      environmentId: string,
    ) => Effect.Effect<void, WriteFailure>;
  }
>()('@porcelain/client/AccessStore') {
  static readonly layer = Layer.effect(
    AccessStore,
    Effect.gen(function* () {
      const storage = yield* EnvironmentStorage;
      const initial: EnvironmentSnapshot = {
        remotes: [],
        missingCredentials: [],
      };
      const owner = yield* persistedState({
        initial,
        read: storage.read,
        write: storage.write,
        messages: {
          beforeRead: 'Saved environments must be read before changing them.',
          readFailed:
            'Saved environments could not be read. Try reading them again.',
          writeFailed:
            'The saved environments could not be updated. Read them again before making changes.',
        },
      });
      return {
        state: owner.state,
        load: owner.load,
        save: Effect.fn('AccessStore.save')((remote: Remote) =>
          owner.write((snapshot) => {
            const missing = snapshot.missingCredentials.find(
              (entry) => entry.environmentId === remote.environmentId,
            );
            const incoming = connectionRoutes(remote);
            const recovered = missing?.operationIdentity
              ? { ...remote, operationIdentity: missing.operationIdentity }
              : remote;
            return Effect.succeed({
              remotes: withRemote(snapshot.remotes, recovered),
              missingCredentials: snapshot.missingCredentials.flatMap(
                (entry) => {
                  if (entry.environmentId !== remote.environmentId)
                    return [entry];
                  const routes = entry.routes.filter(
                    (route) =>
                      !incoming.some((next) => next.address === route.address),
                  );
                  return routes.length ? [{ ...entry, routes }] : [];
                },
              ),
            });
          }),
        ),
        route: Effect.fn('AccessStore.route')((input) =>
          owner.write(({ remotes, missingCredentials }) =>
            Effect.gen(function* () {
              const remote = remotes.find(
                (entry) => entry.environmentId === input.environmentId,
              );
              if (!remote)
                return yield* Effect.fail(
                  new ConnectionError({
                    message: 'That environment is no longer saved.',
                  }),
                );
              const routes = connectionRoutes(remote);
              const chosen = routes.find(
                (route) => route.address === input.address,
              );
              if (!chosen)
                return yield* Effect.fail(
                  new ConnectionError({
                    message: 'That connection is no longer saved.',
                  }),
                );
              const rest = routes.filter(
                (route) => route.address !== input.address,
              );
              if (input.kind === 'remove' && !rest.length)
                return yield* Effect.fail(
                  new ConnectionError({
                    message:
                      'Forget the environment to remove its last connection.',
                  }),
                );
              const updated = withConnectionRoutes(
                remote,
                input.kind === 'prefer' ? [chosen, ...rest] : rest,
              );
              return {
                missingCredentials,
                remotes: remotes.map((entry) =>
                  entry.environmentId === input.environmentId ? updated : entry,
                ),
              };
            }),
          ),
        ),
        forget: Effect.fn('AccessStore.forget')((environmentId: string) =>
          owner.write((snapshot) =>
            Effect.succeed({
              remotes: snapshot.remotes.filter(
                (remote) => remote.environmentId !== environmentId,
              ),
              missingCredentials: snapshot.missingCredentials.filter(
                (remote) => remote.environmentId !== environmentId,
              ),
            }),
          ),
        ),
      };
    }),
  );
}
