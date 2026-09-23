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
  const {
    connection,
    restoring,
    disconnect,
    disconnectError,
    disconnectPending,
  } = useWorkspaceContext();
  return {
    connected: connection !== null,
    restoring,
    disconnect,
    disconnectError,
    disconnectPending,
  };
}

export function openedPairingLink(): PairingCode | null {
  return pairingCode();
}

export function usePairing() {
  const { api, beginConnection } = useWorkspaceContext();
  return asMutation(
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
