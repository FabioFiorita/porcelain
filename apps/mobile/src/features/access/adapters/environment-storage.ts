import { SQLiteStorage } from 'expo-sqlite/kv-store';
import {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} from 'expo-secure-store';
import { z } from 'zod';
import type { EnvironmentStorage } from '@porcelain/client/access';

const metadata = new SQLiteStorage('porcelain-environments.db');
const metadataKey = 'environments';
const savedEnvironmentSchema = z.array(
  z.object({
    environmentId: z.string().min(1),
    name: z.string(),
    address: z.url(),
    deviceId: z.string().min(1),
  }),
);

export const environmentStorage: EnvironmentStorage = {
  async read() {
    const value = await metadata.getItemAsync(metadataKey);
    if (value === null) return [];
    const saved = savedEnvironmentSchema.parse(JSON.parse(value));
    return Promise.all(
      saved.map(async (remote) => {
        const credential = await getItemAsync(
          `porcelain.device.${remote.deviceId}`,
        );
        if (!credential)
          throw new Error(
            `The saved credential for ${remote.name} could not be read. Pair that environment again.`,
          );
        return { ...remote, credential };
      }),
    );
  },
  async write(remotes) {
    const previous = await metadata.getItemAsync(metadataKey);
    const before =
      previous === null
        ? []
        : savedEnvironmentSchema.parse(JSON.parse(previous));
    const next = savedEnvironmentSchema.parse(
      remotes.map(({ credential: _credential, ...remote }) => remote),
    );
    for (const remote of remotes) {
      if (!remote.deviceId)
        throw new Error('The paired environment sent no device identity.');
      await setItemAsync(
        `porcelain.device.${remote.deviceId}`,
        remote.credential,
        { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY },
      );
    }
    await metadata.setItemAsync(metadataKey, JSON.stringify(next));
    for (const old of before) {
      if (!next.some((remote) => remote.deviceId === old.deviceId))
        await deleteItemAsync(`porcelain.device.${old.deviceId}`);
    }
  },
};
