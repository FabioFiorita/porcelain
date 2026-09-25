import { ConnectionError } from '../../../shared/api/connection-error';
import { useMutation } from '@tanstack/react-query';
import { pairingCode } from '../api/pairing-link';
import type { PairingCode } from '../api/pairing-port';
import { refusalMessage } from '../api';
import { REQUEST_TIMEOUT_MS } from '@/shared/api/request-timeout';
import { asMutation } from '@/shared/query/mutation';
import { useWorkspaceContext } from '@/app/workspace-provider';

export function connectionErrorMessage(error: unknown) {
  return error instanceof ConnectionError
    ? error.message
    : (refusalMessage(error) ??
        'Could not connect to the environment. Try again.');
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
