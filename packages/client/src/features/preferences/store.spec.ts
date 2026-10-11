import {
  blockedPersistence,
  promiseStorage,
  unreadablePersistence,
} from '../../../spec/kit/promise-storage.ts';
import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { PreferencesStore } from './store.ts';
import { PreferenceStorage } from './ports/preference-storage.ts';
import {
  defaultPreferences,
  type Preferences,
} from './store/saved-preferences.ts';

function fixture(storage: {
  read: () => Promise<Preferences>;
  write: (value: Preferences) => Promise<void>;
}) {
  return Effect.runSync(
    PreferencesStore.pipe(
      Effect.provide(PreferencesStore.layer),
      Effect.provideService(PreferenceStorage, promiseStorage(storage)),
    ),
  );
}

it('keeps every other saved preference when one changes and restores it after a restart', async () => {
  let saved: Preferences = { ...defaultPreferences, appearance: 'dark' };
  const storage = {
    read: () => Promise.resolve(saved),
    write: (preferences: Preferences) => {
      saved = preferences;
      return Promise.resolve();
    },
  };
  const store = fixture(storage);
  await Effect.runPromise(store.load());
  await Effect.runPromise(store.change({ lineOverflow: 'wrap' }));
  const restarted = fixture(storage);
  expect(restarted.state.value.status).toBe('loading');
  await Effect.runPromise(restarted.load());
  expect(restarted.state.value).toEqual({
    preferences: {
      ...defaultPreferences,
      appearance: 'dark',
      lineOverflow: 'wrap',
    },
    status: 'ready',
    error: undefined,
  });
});

it('keeps the confirmed preferences in use when saving fails and asks for a fresh read', async () => {
  const store = fixture({
    read: () => Promise.resolve(defaultPreferences),
    write: () => Promise.reject(new Error('disk full')),
  });
  await Effect.runPromise(store.load());
  await expect(
    Effect.runPromise(store.change({ appearance: 'light' })),
  ).rejects.toThrow(
    'Preferences could not be saved. Read them again before changing them.',
  );
  expect(store.state.value).toEqual({
    preferences: defaultPreferences,
    status: 'unreadable',
    error:
      'Preferences could not be saved. Read them again before changing them.',
  });
});

it('keeps both of two quick changes when the first is still being saved', async () => {
  const persistence = blockedPersistence(defaultPreferences);
  const store = fixture(persistence.storage);
  await Effect.runPromise(store.load());
  const first = Effect.runPromise(store.change({ appearance: 'dark' }));
  await persistence.started.promise;
  const second = Effect.runPromise(store.change({ lineOverflow: 'wrap' }));
  persistence.finish.resolve();
  await Promise.all([first, second]);
  expect(persistence.writes.at(-1)).toEqual({
    ...defaultPreferences,
    appearance: 'dark',
    lineOverflow: 'wrap',
  });
});

it('reports unreadable saved preferences and refuses changes until they are read', async () => {
  const persistence = unreadablePersistence<Preferences>();
  const store = fixture(persistence.storage);
  await Effect.runPromise(store.load());
  expect(store.state.value).toEqual({
    preferences: defaultPreferences,
    status: 'unreadable',
    error: 'Saved preferences could not be read. Try reading them again.',
  });
  await expect(
    Effect.runPromise(store.change({ appearance: 'dark' })),
  ).rejects.toThrow('Saved preferences must be read before changing them.');
  expect(persistence.writeCount()).toBe(0);
});
