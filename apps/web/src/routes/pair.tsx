import {
  pairingDestination,
  clearPairingDestination,
} from '@/features/access/index';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useAtomMount } from '@effect/atom-react';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import {
  DisconnectedPage,
  NotPaired,
  pairBrowser,
  PairingView,
  pairingLinkChanges,
  restoreSession,
} from '@/features/access/index';
import { parsePairingLink } from '@porcelain/client/access/rules';
import { PAIRING_PENDING_MS } from '@/config/limits';
import { WorkspaceError } from '@/app/workspace-error';

export const Route = createFileRoute('/pair')({
  preload: false,
  pendingMs: PAIRING_PENDING_MS,
  pendingComponent: PairingView,
  loader: async ({ context, abortController }) => {
    const destination = pairingDestination();
    const fragment = window.location.hash;
    if (!fragment) {
      if (await restoreSession(context.registry))
        redirect({ href: destination, replace: true, throw: true });
      return undefined;
    }
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    const link = parsePairingLink(fragment);
    if (!link) return { reason: 'That link carried no pairing code.' };
    try {
      await pairBrowser(context.registry, link, abortController.signal);
    } catch (error) {
      if (await restoreSession(context.registry))
        redirect({ href: destination, replace: true, throw: true });
      return { reason: connectionErrorMessage(error) };
    }
    clearPairingDestination();
    redirect({ href: destination, replace: true, throw: true });
  },
  errorComponent: WorkspaceError,
  component: PairRoute,
});

function PairRoute() {
  const data = Route.useLoaderData();
  const pending = Route.useMatch({
    select: (match) => match.isFetching === 'loader',
  });
  const router = useRouter();
  useAtomMount(
    pairingLinkChanges(() => {
      void router.invalidate();
    }),
  );
  return (
    <DisconnectedPage>
      <NotPaired
        pending={pending}
        reason={pending ? undefined : data?.reason}
      />
    </DisconnectedPage>
  );
}
