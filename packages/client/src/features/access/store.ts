import { Context, Effect, Layer } from 'effect';
import { AtomRef } from 'effect/reactivity';
import {
  createWriteQueue,
  type WriteNotSentError,
} from '../../shared/api/write-queue.ts';
import { ConnectionError } from '../../shared/api/connection-error.ts';
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
      const state = AtomRef.make<AccessState>({
        remotes: [],
        status: 'loading',
        error: undefined,
      });
      const queue = createWriteQueue();
      const write = Effect.fn('AccessStore.write')(function* (
        update: (remotes: readonly Remote[]) => Remote[],
      ) {
        yield* queue.enqueue(
          Effect.gen(function* () {
            if (state.value.status !== 'ready')
              return yield* Effect.fail(
                new ConnectionError({
                  message:
                    'Saved environments must be read before changing them.',
                }),
              );
            const remotes = update(state.value.remotes);
            const message =
              'The saved environments could not be updated. Read them again before making changes.';
            yield* storage.write(remotes).pipe(
              Effect.mapError(
                ({ cause }) => new ConnectionError({ message, cause }),
              ),
              Effect.tapError(() =>
                Effect.sync(() =>
                  state.update((current) => ({
                    ...current,
                    status: 'unreadable',
                    error: message,
                  })),
                ),
              ),
              Effect.tap(() =>
                Effect.sync(() =>
                  state.update((current) => ({ ...current, remotes })),
                ),
              ),
              Effect.uninterruptible,
            );
          }),
        );
      });
      return {
        state,
        load: Effect.fn('AccessStore.load')(function* () {
          yield* queue.enqueue(
            Effect.gen(function* () {
              state.update((current) => ({
                ...current,
                status: 'loading',
                error: undefined,
              }));
              yield* storage.read().pipe(
                Effect.matchEffect({
                  onSuccess: (remotes) =>
                    Effect.sync(() =>
                      state.set({ remotes, status: 'ready', error: undefined }),
                    ),
                  onFailure: () =>
                    Effect.sync(() =>
                      state.update((current) => ({
                        ...current,
                        status: 'unreadable',
                        error:
                          'Saved environments could not be read. Try reading them again.',
                      })),
                    ),
                }),
                Effect.uninterruptible,
              );
            }),
          );
        }),
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
