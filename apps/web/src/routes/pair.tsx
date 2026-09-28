import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  connectionErrorMessage,
  DisconnectedPage,
  NotPaired,
  pairBrowser,
  parsePairingLink,
  PairingView,
} from '@/features/access/index';
import { PAIRING_PENDING_MS } from '@/config/limits';

export const Route = createFileRoute('/pair')({
  preload: false,
  pendingMs: PAIRING_PENDING_MS,
  pendingComponent: PairingView,
  loader: async ({ context, abortController }) => {
    const fragment = window.location.hash;
    if (!fragment) return undefined;
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    const link = parsePairingLink(fragment);
    if (!link) return { reason: 'That link carried no pairing code.' };
    try {
      await pairBrowser(context.queryClient, link, abortController.signal);
    } catch (error) {
      return { reason: connectionErrorMessage(error) };
    }
    redirect({ to: '/', replace: true, throw: true });
  },
  component: PairRoute,
});

function PairRoute() {
  const data = Route.useLoaderData();
  return (
    <DisconnectedPage>
      {data ? <NotPaired reason={data.reason} /> : <NotPaired />}
    </DisconnectedPage>
  );
}
