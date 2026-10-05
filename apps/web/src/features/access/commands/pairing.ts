import { MutationObserver, type QueryClient } from '@tanstack/react-query';
import { redeemBrowserPairing } from '@porcelain/client/access';
import { runRequest } from '@porcelain/client/transport';
import { browserTransport } from '@/shared/api/transport';
import { pairingPlatform } from '../store';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import type { PairingCode } from '@porcelain/client/access/rules';
import { useAccessStore } from '../store';
import { ConnectionError } from '@porcelain/client/transport';
import { REQUEST_TIMEOUT_MS } from '@/config/limits';

async function redeemPairing(link: PairingCode, signal: AbortSignal) {
  try {
    return await runRequest(
      redeemBrowserPairing(browserTransport(fetch), pairingPlatform, link),
      AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    );
  } catch (error) {
    throw new ConnectionError({
      message: connectionErrorMessage(error),
      cause: error,
    });
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
    onSuccess: (session, _link, context) => {
      if (!context.complete?.(session)) return;
      client.clear();
    },
  });
  const session = await mutation.mutate(link);
  if (
    useAccessStore.getState().connection?.environmentId !==
    session.inventory.environmentId
  )
    throw new ConnectionError({
      message: 'Could not connect to the environment. Try again.',
    });
}
