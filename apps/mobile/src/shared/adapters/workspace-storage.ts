import { Effect, Layer } from 'effect';
import * as KeyValueStore from 'effect/persistence/KeyValueStore';
import { Atom } from 'effect/reactivity';
import { SQLiteStorage } from 'expo-sqlite/kv-store';

const storage = new SQLiteStorage('porcelain-workspaces.db');
const operation = <T>(method: string, run: () => T) =>
  Effect.try({
    try: run,
    catch: (cause) =>
      new KeyValueStore.KeyValueStoreError({
        method,
        message: 'Workspace layout storage failed.',
        cause,
      }),
  });

export const workspaceStorageRuntime = Atom.runtime(
  Layer.sync(KeyValueStore.KeyValueStore, () =>
    KeyValueStore.makeStringOnly({
      get: (key) =>
        operation('get', () => storage.getItemSync(key) ?? undefined),
      set: (key, value) =>
        operation('set', () => storage.setItemSync(key, value)),
      remove: (key) =>
        operation('remove', () => {
          storage.removeItemSync(key);
        }),
      clear: operation('clear', () => {
        storage.clearSync();
      }),
      size: operation('size', () => storage.getAllKeysSync().length),
    }),
  ),
);
