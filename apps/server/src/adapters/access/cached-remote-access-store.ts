import { Duration, Effect, Layer } from 'effect';
import { RemoteAccessStore } from '@porcelain/access/ports';

export const cachedRemoteAccessStoreLayer = Layer.effect(
  RemoteAccessStore,
  Effect.gen(function* () {
    const settings = yield* RemoteAccessStore;
    const [read, invalidate] = yield* Effect.cachedInvalidateWithTTL(
      settings.read(),
      Duration.infinity,
    );
    return RemoteAccessStore.of({
      read: Effect.fn('RemoteAccessCache.read')(function* () {
        return structuredClone(yield* read);
      }),
      save: Effect.fn('RemoteAccessCache.save')(function* (input) {
        yield* settings.save(input);
        yield* invalidate;
      }),
    });
  }),
);
