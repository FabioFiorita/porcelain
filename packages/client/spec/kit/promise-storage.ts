import { controlledPromise } from './promise.ts';
import { Cause, Effect } from 'effect';
export function promiseStorage<Value, Saved = Value>(storage: {
  read: () => Promise<Value>;
  write: (value: Saved) => Promise<void>;
}) {
  return {
    read: () =>
      Effect.tryPromise({
        try: storage.read,
        catch: (cause) => new Cause.UnknownError(cause),
      }),
    write: (value: Saved) =>
      Effect.tryPromise({
        try: () => storage.write(value),
        catch: (cause) => new Cause.UnknownError(cause),
      }),
  };
}
export function blockedPersistence<Value>(initial: Value) {
  const started = controlledPromise<void>();
  const finish = controlledPromise<void>();
  const writes: Value[] = [];
  return {
    started,
    finish,
    writes,
    storage: {
      read: () => Promise.resolve(initial),
      write: async (value: Value) => {
        writes.push(value);
        if (writes.length === 1) {
          started.resolve();
          await finish.promise;
        }
      },
    },
  };
}

export function unreadablePersistence<Value>() {
  let writes = 0;
  return {
    writeCount: () => writes,
    storage: {
      read: (): Promise<Value> =>
        Promise.reject(new Error('private storage detail')),
      write: (_value: Value) => {
        writes += 1;
        return Promise.resolve();
      },
    },
  };
}
