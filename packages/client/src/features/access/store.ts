import { persistedState } from '../persistence/store.ts';
import { Context, Effect, Layer } from 'effect';
import type { AtomRef } from 'effect/reactivity';
import { type WriteNotSentError } from '../../shared/api/write-queue.ts';
import type { ConnectionError } from '../../shared/api/connection-error.ts';
import { EnvironmentStorage } from './ports/environment-storage.ts';
import { withRemote, type Remote } from './rules/remotes.ts';

type AccessState = {
  readonly remotes: readonly Remote[];
  readonly status: 'loading' | 'ready' | 'unreadable';
  readonly error: string | undefined;
};

type WriteFailure = ConnectionError | WriteNotSentError;

export class AccessStore extends Context.Service<
  AccessStore,
  {
    readonly state: AtomRef.ReadonlyRef<AccessState>;
    readonly load: () => Effect.Effect<void, WriteFailure>;
    readonly save: (remote: Remote) => Effect.Effect<void, WriteFailure>;
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
        forget: Effect.fn('AccessStore.forget')((environmentId: string) =>
          write((remotes) =>
            remotes.filter((remote) => remote.environmentId !== environmentId),
          ),
        ),
      };
    }),
  );
}
