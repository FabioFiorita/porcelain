import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { useMutation } from '@tanstack/react-query';
import { pairingCode } from '../api/pairing/link';
import type { PairingCode } from '../api/pairing/port';
import { REQUEST_TIMEOUT_MS } from '../lib/request-timeout';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

export function connectionErrorMessage(error: unknown) {
  return error instanceof ConnectionError
    ? error.message
    : 'Could not connect to the environment. Try again.';
}

export function useConnection() {
  const { connection, disconnect, disconnectError, disconnectPending } =
    useWorkspaceContext();
  return {
    connected: connection !== null,
    disconnect,
    disconnectError,
    disconnectPending,
  };
}

/**
 * The pairing code this page was opened with, if any. It was taken out of the
 * address bar when the application loaded and has lived in memory since.
 */
export function openedPairingLink(): PairingCode | null {
  return pairingCode();
}

/**
 * Redeem a pairing link. There is nothing for the owner to type: the code came
 * from the address bar and was erased before this ran, and the credential it
 * buys is a cookie this page can never read.
 */
export function usePairing() {
  const { api, beginConnection } = useWorkspaceContext();
  return asMutation(
    // Pairing seeds the cache in WorkspaceProvider; this is not a server-data write.
    // react-doctor-disable-next-line react-doctor/query-mutation-missing-invalidation
    useMutation({
      mutationFn: async (link: PairingCode) => {
        const complete = beginConnection();
        const inventory = await api.pairing.redeem({
          ...link,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        return complete?.(inventory) ?? false;
      },
    }),
  );
}
