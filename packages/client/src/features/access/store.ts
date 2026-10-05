import { Effect } from 'effect';
import {
  createWriteQueue,
  type WriteNotSentError,
} from '../../shared/api/write-queue.ts';
import { createStore } from 'zustand/vanilla';
import { ConnectionError } from '../../shared/api/connection-error.ts';
import type { EnvironmentStorage } from './ports/environment-storage.ts';
import { withRemote, type Remote } from './rules/remotes.ts';

type AccessState = {
  remotes: Remote[];
  status: 'loading' | 'ready' | 'unreadable';
  error: string | undefined;
  load: () => Effect.Effect<void, ConnectionError | WriteNotSentError>;
  save: (
    remote: Remote,
  ) => Effect.Effect<void, ConnectionError | WriteNotSentError>;
  forget: (
    environmentId: string,
  ) => Effect.Effect<void, ConnectionError | WriteNotSentError>;
};

export function createAccessStore(storage: EnvironmentStorage) {
  return createStore<AccessState>()((set, get) => {
    const queue = createWriteQueue();
    function write(update: (remotes: readonly Remote[]) => Remote[]) {
      return queue.enqueue(
        Effect.gen(function* () {
          if (get().status !== 'ready')
            return yield* Effect.fail(
              new ConnectionError({
                message:
                  'Saved environments must be read before changing them.',
              }),
            );
          const remotes = update(get().remotes);
          const message =
            'The saved environments could not be updated. Read them again before making changes.';
          yield* Effect.tryPromise({
            try: () => storage.write(remotes),
            catch: (cause) => new ConnectionError({ message: message, cause }),
          }).pipe(
            Effect.tapError(() =>
              Effect.sync(() => set({ status: 'unreadable', error: message })),
            ),
          );
          set({ remotes });
        }),
      );
    }
    return {
      remotes: [],
      status: 'loading',
      error: undefined,
      load: () =>
        queue.enqueue(
          Effect.gen(function* () {
            set({ status: 'loading', error: undefined });
            yield* Effect.tryPromise({
              try: () => storage.read(),
              catch: (cause) =>
                new ConnectionError({
                  message:
                    'Saved environments could not be read. Try reading them again.',
                  cause,
                }),
            }).pipe(
              Effect.matchEffect({
                onSuccess: (remotes) =>
                  Effect.sync(() => set({ remotes, status: 'ready' })),
                onFailure: (error) =>
                  Effect.sync(() =>
                    set({ status: 'unreadable', error: error.message }),
                  ),
              }),
            );
          }),
        ),
      save: (remote) => write((remotes) => withRemote(remotes, remote)),
      forget: (environmentId) =>
        write((remotes) =>
          remotes.filter((remote) => remote.environmentId !== environmentId),
        ),
    };
  });
}

export type AccessStore = ReturnType<typeof createAccessStore>;
