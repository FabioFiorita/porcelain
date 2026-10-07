import type { AtomRegistry } from 'effect/reactivity';
import {
  readBrowserSession,
  restoreBrowserConnection,
} from '@porcelain/client/access';
import { browserTransport } from '@/shared/api/transport';
import { applicationRuntime } from '../store';

const restoredSession = readBrowserSession(
  browserTransport(fetch, { reportUnauthorized: false }),
);

export function restoreSession(registry: AtomRegistry.AtomRegistry) {
  return applicationRuntime.runPromise(
    restoreBrowserConnection(registry, restoredSession),
  );
}
