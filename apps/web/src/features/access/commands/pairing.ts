import { Atom, type AtomRegistry } from 'effect/reactivity';
import {
  pairBrowserSession,
  connectBrowserSession,
} from '@porcelain/client/access';
import { browserTransport } from '@/shared/api/transport';
import { pairingPlatform } from '../store';
import type { PairingCode } from '@porcelain/client/access/rules';
import { applicationRuntime } from '../store';
import { REQUEST_TIMEOUT_MS } from '@/config/limits';

const pairing = pairBrowserSession({
  transport: browserTransport(fetch),
  platform: pairingPlatform,
});

export function pairBrowser(
  registry: AtomRegistry.AtomRegistry,
  link: PairingCode,
  signal: AbortSignal,
) {
  return applicationRuntime.runPromise(
    connectBrowserSession(registry, pairing, link, REQUEST_TIMEOUT_MS),
    { signal },
  );
}

export const pairingLinkChanges = Atom.family((invalidate: () => void) =>
  Atom.make((get) => {
    const pairFromLink = () => {
      if (window.location.hash) invalidate();
    };
    window.addEventListener('hashchange', pairFromLink);
    get.addFinalizer(() =>
      window.removeEventListener('hashchange', pairFromLink),
    );
  }),
);
