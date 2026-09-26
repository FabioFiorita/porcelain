import { MutationObserver, type QueryClient } from '@tanstack/react-query';
import { accessApi } from '../api';
import { connectionErrorMessage } from '../rules/connection-error-message';
import type { PairingCode } from '../rules/pairing-link';
import { useAccessStore } from '../store';
import { ConnectionError } from '@/shared/api/connection-error';
import { REQUEST_TIMEOUT_MS } from '@/shared/api/request-timeout';

async function redeemPairing(link: PairingCode, signal: AbortSignal) {
  try {
    return await accessApi.pairing.redeem({
      ...link,
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ]),
    });
  } catch (error) {
    throw new ConnectionError(connectionErrorMessage(error), { cause: error });
  }
}

export async function pairBrowser(
  client: QueryClient,
  link: PairingCode,
  signal: AbortSignal,
) {
  const mutation = new MutationObserver(client, {
    scope: { id: 'access.pairing' },
    onMutate: () => ({
      complete: useAccessStore.getState().beginConnection(),
    }),
    mutationFn: (code: PairingCode) => redeemPairing(code, signal),
    onSuccess: (inventory, _link, context) => {
      if (!context.complete?.(inventory)) return;
      client.clear();
    },
  });
  const inventory = await mutation.mutate(link);
  if (
    useAccessStore.getState().connection?.environmentId !==
    inventory.environmentId
  )
    throw new ConnectionError(
      'Could not connect to the environment. Try again.',
    );
}
