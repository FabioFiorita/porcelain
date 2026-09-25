import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accessApi, connectionErrorMessage, type PairingCode } from '../api';
import { useAccessStore } from '../store';
import { ConnectionError } from '@/shared/api/connection-error';
import { REQUEST_TIMEOUT_MS } from '@/shared/api/request-timeout';

async function redeemPairing(link: PairingCode) {
  try {
    return await accessApi.pairing.redeem({
      ...link,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ConnectionError(connectionErrorMessage(error), { cause: error });
  }
}

export function usePairing() {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: 'access.pairing' },
    onMutate: () => ({
      complete: useAccessStore.getState().beginConnection(),
    }),
    mutationFn: redeemPairing,
    onSuccess: (inventory, _link, context) => {
      if (!context.complete?.(inventory)) return;
      client.clear();
    },
  });
  return { submit: mutation.mutateAsync, error: mutation.error };
}
