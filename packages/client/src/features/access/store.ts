import { createStore } from 'zustand/vanilla';
import { ConnectionError } from '../../shared/api/connection-error.ts';
import type { EnvironmentStorage } from './ports/environment-storage.ts';
import { withRemote, type Remote } from './rules/remotes.ts';

type AccessState = {
  remotes: Remote[];
  status: 'loading' | 'ready' | 'unreadable';
  error: string | undefined;
  load: () => Promise<void>;
  save: (remote: Remote) => Promise<void>;
  forget: (environmentId: string) => Promise<void>;
};

export function createAccessStore(storage: EnvironmentStorage) {
  return createStore<AccessState>()((set, get) => {
    async function write(remotes: Remote[]) {
      if (get().status !== 'ready')
        throw new ConnectionError(
          'Saved environments must be read before changing them.',
        );
      try {
        await storage.write(remotes);
        set({ remotes });
      } catch (error) {
        const message =
          'The saved environments could not be updated. Read them again before making changes.';
        set({ status: 'unreadable', error: message });
        throw new ConnectionError(message, { cause: error });
      }
    }
    return {
      remotes: [],
      status: 'loading',
      error: undefined,
      async load() {
        set({ status: 'loading', error: undefined });
        try {
          const remotes = await storage.read();
          set({ remotes, status: 'ready' });
        } catch {
          set({
            status: 'unreadable',
            error:
              'Saved environments could not be read. Try reading them again.',
          });
        }
      },
      save: (remote) => write(withRemote(get().remotes, remote)),
      forget: (environmentId) =>
        write(
          get().remotes.filter(
            (remote) => remote.environmentId !== environmentId,
          ),
        ),
    };
  });
}

export type AccessStore = ReturnType<typeof createAccessStore>;
