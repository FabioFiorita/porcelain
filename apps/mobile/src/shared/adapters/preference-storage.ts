import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { Cause, Effect, Schema } from 'effect';
import {
  PreferenceStorage,
  preferencesSchema,
  readPreferences,
} from '@porcelain/client/preferences';

const storage = new SQLiteStorage('porcelain-preferences.db');
const key = 'preferences';
const encode = Schema.encodeSync(Schema.fromJsonString(preferencesSchema));

export const preferenceStorage = PreferenceStorage.of({
  read: () =>
    Effect.try({
      try: () => readPreferences(storage.getItemSync(key)),
      catch: (cause) => new Cause.UnknownError(cause),
    }),
  write: (preferences) =>
    Effect.try({
      try: () => storage.setItemSync(key, encode(preferences)),
      catch: (cause) => new Cause.UnknownError(cause),
    }),
});
