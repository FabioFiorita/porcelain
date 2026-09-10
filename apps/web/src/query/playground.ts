import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  copyPlaygroundToken,
  readPlaygroundCredentials,
} from '../api/playground-credentials';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

export function usePlaygroundAction() {
  const { api, beginConnection } = useWorkspaceContext();
  return asMutation(
    // Session completion seeds/clears the cache in WorkspaceProvider; this is not a server-data write.
    // react-doctor-disable-next-line react-doctor/query-mutation-missing-invalidation
    useMutation({
      mutationFn: async (action: 'reveal' | 'copy' | 'connect') => {
        const complete = action === 'connect' ? beginConnection() : null;
        const credentials = await readPlaygroundCredentials();
        if (action === 'copy') await copyPlaygroundToken(credentials.token);
        if (!complete) return { ...credentials, connected: false };
        const inventory = await api.inventory.read({
          token: credentials.token,
          signal: AbortSignal.timeout(15_000),
        });
        return {
          token: '',
          tokenFile: credentials.tokenFile,
          connected: complete(credentials.token, inventory),
        };
      },
    }),
  );
}

export function useAutomaticPlaygroundConnection() {
  const { api, beginConnection } = useWorkspaceContext();
  const [failed, setFailed] = useState(false);
  // Startup is uncached; cleanup aborts IO and suppresses obsolete error updates.
  // react-doctor-disable-next-line react-doctor/no-set-state-after-await-in-effect
  useEffect(() => {
    const complete = beginConnection(true);
    if (!complete) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(15_000),
    ]);
    const connect = async () => {
      try {
        const { token } = await readPlaygroundCredentials(signal);
        const inventory = await api.inventory.read({ token, signal });
        signal.throwIfAborted();
        complete(token, inventory);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };
    void connect();
    return () => controller.abort();
  }, [api, beginConnection]);
  return failed;
}
