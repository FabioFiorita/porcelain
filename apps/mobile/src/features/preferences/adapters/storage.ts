import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { Cause, Effect, Schema } from 'effect';
import {
  preferencesSchema,
  readPreferences,
  type Preferences,
} from '@porcelain/client/preferences';

const storage = new SQLiteStorage('porcelain-preferences.db');
const key = 'preferences';

export const preferenceStorage = {
  read: () =>
    Effect.try({
      try: () => readPreferences(storage.getItemSync(key)),
      catch: (cause) => new Cause.UnknownError(cause),
    }),
  write: (preferences: Preferences) =>
    Effect.try({
      try: () =>
        storage.setItemSync(
          key,
          JSON.stringify(Schema.encodeSync(preferencesSchema)(preferences)),
        ),
      catch: (cause) => new Cause.UnknownError(cause),
    }),
};
