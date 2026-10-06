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

export const environmentStorage = EnvironmentStorage.of({
  read: () =>
    Effect.tryPromise({
      try: async () => {
        const value = await metadata.getItemAsync(metadataKey);
        if (value === null) return [];
        const saved = decode(JSON.parse(value));
        return Promise.all(
          saved.map(async (remote) => {
            const credential = await getItemAsync(
              `porcelain.device.${remote.deviceId}`,
            );
            if (!credential)
              throw new Error(
                `The saved credential for ${remote.name} could not be read. Pair that environment again.`,
              );
            return { ...remote, credential: Redacted.make(credential) };
          }),
        );
      },
      catch: (cause) => new Cause.UnknownError(cause),
    }),
  write: (remotes) =>
    Effect.tryPromise({
      try: async () => {
        const previous = await metadata.getItemAsync(metadataKey);
        const before = previous === null ? [] : decode(JSON.parse(previous));
        const next = decode(
          remotes.map(({ credential: _credential, ...remote }) => remote),
        );
        for (const remote of remotes) {
          if (!remote.deviceId)
            throw new Error('The paired environment sent no device identity.');
          await setItemAsync(
            `porcelain.device.${remote.deviceId}`,
            Redacted.value(remote.credential),
            { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY },
          );
        }
        await metadata.setItemAsync(metadataKey, JSON.stringify(next));
        for (const old of before) {
          if (!next.some((remote) => remote.deviceId === old.deviceId))
            await deleteItemAsync(`porcelain.device.${old.deviceId}`);
        }
      },
      catch: (cause) => new Cause.UnknownError(cause),
    }),
});
