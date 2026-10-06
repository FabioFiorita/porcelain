import { Effect } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { readBrowserSession } from '@porcelain/client/access';
import { browserTransport } from '@/shared/api/transport';
import { accessSession } from '../store';

const restoredSession = readBrowserSession(
  browserTransport(fetch, { reportUnauthorized: false }),
);

export async function restoreSession(registry: AtomRegistry.AtomRegistry) {
  if (accessSession.state.value.connection) return true;
  const complete = accessSession.beginConnection(true);
  if (!complete) return false;
  const result = registry.get(restoredSession);
  if (AsyncResult.isFailure(result) && !result.waiting)
    registry.refresh(restoredSession);
  const session = await Effect.runPromise(
    AtomRegistry.getResult(registry, restoredSession, {
      suspendOnWaiting: true,
    }),
  );
  if (session === null) return false;
  complete(session);
  return accessSession.state.value.connection !== null;
}
