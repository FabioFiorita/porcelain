import { Effect } from 'effect';
import { OperationStorage } from '@porcelain/client/git-actions';

export function operationStorage(key: string | undefined) {
  return OperationStorage.of({
    read: () =>
      Effect.try(() => {
        if (!key)
          throw new Error(
            'Pair this environment again to identify its pending Git operations.',
          );
        return window.sessionStorage.getItem(key);
      }),
    write: (value) =>
      Effect.try(() => {
        if (!key)
          throw new Error(
            'Pending Git operations require an identified connection.',
          );
        window.sessionStorage.setItem(key, value);
      }),
    clear: () =>
      Effect.try(() => {
        if (!key)
          throw new Error(
            'Pending Git operations require an identified connection.',
          );
        window.sessionStorage.removeItem(key);
      }),
  });
}
