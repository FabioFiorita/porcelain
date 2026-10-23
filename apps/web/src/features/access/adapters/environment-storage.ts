import { Cause, Effect } from 'effect';
import { EnvironmentStorage } from '@porcelain/client/access';
import { parseRemotes, serializeRemotes } from '@porcelain/client/access/rules';
import { desktopCredentials } from '@/shared/adapters/desktop';
import { savedRemotes } from '../rules/remotes';

export const environmentStorage = EnvironmentStorage.of({
  read: () =>
    Effect.tryPromise({
      try: async () => {
        const credentials = desktopCredentials();
        if (!credentials) {
          const value = localStorage.getItem('porcelain.remotes');
          return {
            remotes: value === null ? [] : parseRemotes(JSON.parse(value)),
            missingCredentials: [],
          };
        }
        const saved = savedRemotes(await credentials.read());
        if (saved.kind === 'unreadable') throw new Error(saved.message);
        return { remotes: saved.remotes ?? [], missingCredentials: [] };
      },
      catch: (cause) => new Cause.UnknownError(cause),
    }),
  write: ({ remotes }) =>
    Effect.tryPromise({
      try: async () => {
        const credentials = desktopCredentials();
        const saved = serializeRemotes(remotes);
        if (credentials) await credentials.write(saved);
        else localStorage.setItem('porcelain.remotes', saved);
      },
      catch: (cause) => new Cause.UnknownError(cause),
    }),
});
