import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { promiseStorage } from '../../../spec/kit/promise-storage.ts';
import { persistedState } from './store.ts';
const messages = {
  beforeRead: 'Read saved state first.',
  readFailed: 'Could not read saved state.',
  writeFailed: 'Could not update saved state.',
};
it('keeps confirmed state after persistence fails, blocks more writes and permits an explicit reload', async () => {
  let writes = 0;
  const store = Effect.runSync(
    persistedState({
      initial: { value: 'default' },
      ...promiseStorage({
        read: () => Promise.resolve({ value: 'saved' }),
        write: () => {
          writes += 1;
          return Promise.reject(new Error('storage failed'));
        },
      }),
      messages,
    }),
  );
  await Effect.runPromise(store.load());
  await expect(
    Effect.runPromise(store.write(() => Effect.succeed({ value: 'new' }))),
  ).rejects.toThrow('Could not update saved state.');
  expect(store.state.value).toEqual({
    value: 'saved',
    status: 'unreadable',
    error: 'Could not update saved state.',
  });
  await expect(
    Effect.runPromise(store.write(() => Effect.succeed({ value: 'later' }))),
  ).rejects.toThrow('Read saved state first.');
  expect(writes).toBe(1);
  await Effect.runPromise(store.load());
  expect(store.state.value).toEqual({
    value: 'saved',
    status: 'ready',
    error: undefined,
  });
});
