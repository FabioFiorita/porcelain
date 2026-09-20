import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { requestPlaygroundLink } from '../api/pairing/playground';
import { REQUEST_TIMEOUT_MS } from '../lib/request-timeout';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

/**
 * Pair this browser with the playground. It goes through the same redemption
 * the owner's own link uses; only where the link came from differs.
 */
export function usePlaygroundPairing() {
  const { api, beginConnection } = useWorkspaceContext();
  return asMutation(
    // Pairing seeds the cache in WorkspaceProvider; this is not a server-data write.
    // react-doctor-disable-next-line react-doctor/query-mutation-missing-invalidation
    useMutation({
      mutationFn: async () => {
        const complete = beginConnection();
        const link = await requestPlaygroundLink();
        const inventory = await api.pairing.redeem({
          ...link,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        return complete?.(inventory) ?? false;
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
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ]);
    const connect = async () => {
      try {
        const link = await requestPlaygroundLink(signal);
        const inventory = await api.pairing.redeem({ ...link, signal });
        signal.throwIfAborted();
        complete(inventory);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };
    void connect();
    return () => controller.abort();
  }, [api, beginConnection]);
  return failed;
}
