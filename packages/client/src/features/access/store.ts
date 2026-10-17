import { persistedState } from '../persistence/store.ts';
import { Context, Effect, Layer } from 'effect';
import type { AtomRef } from 'effect/reactivity';
import { ConnectionError } from '../../shared/api/connection-error.ts';
import { type WriteNotSentError } from '../../shared/api/write-queue.ts';
import { EnvironmentStorage } from './ports/environment-storage.ts';
import {
  withRemote,
  connectionRoutes,
  withConnectionRoutes,
  type Remote,
} from './rules/remotes.ts';
import type { PersistedReadState } from '../persistence/rules/read-state.ts';

type AccessState = PersistedReadState & {
  readonly remotes: readonly Remote[];
};

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
      const owner = yield* persistedState({
        initial: { remotes: [] as readonly Remote[] },
        read: () => Effect.map(storage.read(), (remotes) => ({ remotes })),
        write: ({ remotes }) => storage.write(remotes),
        messages: {
          beforeRead: 'Saved environments must be read before changing them.',
          readFailed:
            'Saved environments could not be read. Try reading them again.',
          writeFailed:
            'The saved environments could not be updated. Read them again before making changes.',
        },
      });
      const write = (update: (remotes: readonly Remote[]) => Remote[]) =>
        owner.write(({ remotes }) =>
          Effect.succeed({ remotes: update(remotes) }),
        );
      return {
        state: owner.state,
        load: owner.load,
        save: Effect.fn('AccessStore.save')((remote: Remote) =>
          write((remotes) => withRemote(remotes, remote)),
        ),
        route: Effect.fn('AccessStore.route')((input) =>
          owner.write(({ remotes }) =>
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
                remotes: remotes.map((entry) =>
                  entry.environmentId === input.environmentId ? updated : entry,
                ),
              };
            }),
          ),
        ),
        forget: Effect.fn('AccessStore.forget')((environmentId: string) =>
          write((remotes) =>
            remotes.filter((remote) => remote.environmentId !== environmentId),
          ),
        ),
      };
    }),
  );
}
