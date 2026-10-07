import { SQLiteStorage } from 'expo-sqlite/kv-store';
import {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} from 'expo-secure-store';
import { Cause, Effect, Redacted, Schema } from 'effect';
import { EnvironmentStorage } from '@porcelain/client/access';

const metadata = new SQLiteStorage('porcelain-environments.db');
const metadataKey = 'environments';
const savedEnvironmentSchema = Schema.Array(
  Schema.Struct({
    environmentId: Schema.String.check(Schema.isMinLength(1)),
    name: Schema.String,
    address: Schema.String.check(
      Schema.makeFilter((value) => URL.canParse(value)),
    ),
    deviceId: Schema.String.check(Schema.isMinLength(1)),
  }),
);
const decode = Schema.decodeUnknownSync(savedEnvironmentSchema);

const readMetadata = Effect.fn('EnvironmentStorage.readMetadata')(function* () {
  const value = yield* Effect.tryPromise({
    try: () => metadata.getItemAsync(metadataKey),
    catch: (cause) => new Cause.UnknownError(cause),
  });
  if (value === null) return [];
  return yield* Effect.try({
    try: () => decode(JSON.parse(value)),
    catch: (cause) => new Cause.UnknownError(cause),
  });
});

export const environmentStorage = EnvironmentStorage.of({
  read: () =>
    Effect.gen(function* () {
      const saved = yield* readMetadata();
      return yield* Effect.forEach(
        saved,
        (remote) =>
          Effect.gen(function* () {
            const credential = yield* Effect.tryPromise({
              try: () => getItemAsync(`porcelain.device.${remote.deviceId}`),
              catch: (cause) => new Cause.UnknownError(cause),
            });
            if (!credential)
              return yield* Effect.fail(
                new Cause.UnknownError(
                  undefined,
                  `The saved credential for ${remote.name} could not be read. Pair that environment again.`,
                ),
              );
            return { ...remote, credential: Redacted.make(credential) };
          }),
        { concurrency: 'unbounded' },
      );
    }),
  write: (remotes) =>
    Effect.gen(function* () {
      const before = yield* readMetadata();
      const next = yield* Effect.try({
        try: () =>
          decode(
            remotes.map(({ credential: _credential, ...remote }) => remote),
          ),
        catch: (cause) => new Cause.UnknownError(cause),
      });
      for (const remote of remotes) {
        if (!remote.deviceId)
          return yield* Effect.fail(
            new Cause.UnknownError(
              undefined,
              'The paired environment sent no device identity.',
            ),
          );
        yield* Effect.tryPromise({
          try: () =>
            setItemAsync(
              `porcelain.device.${remote.deviceId}`,
              Redacted.value(remote.credential),
              { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY },
            ),
          catch: (cause) => new Cause.UnknownError(cause),
        });
      }
      yield* Effect.tryPromise({
        try: () => metadata.setItemAsync(metadataKey, JSON.stringify(next)),
        catch: (cause) => new Cause.UnknownError(cause),
      });
      for (const old of before)
        if (!next.some((remote) => remote.deviceId === old.deviceId))
          yield* Effect.tryPromise({
            try: () => deleteItemAsync(`porcelain.device.${old.deviceId}`),
            catch: (cause) => new Cause.UnknownError(cause),
          });
    }),
});
