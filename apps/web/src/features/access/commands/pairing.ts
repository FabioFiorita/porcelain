import { Cause, Effect, Exit } from 'effect';
import { Atom, AtomRegistry } from 'effect/reactivity';
import { pairBrowserSession } from '@porcelain/client/access';
import { browserTransport } from '@/shared/api/transport';
import { pairingPlatform } from '../store';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import type { PairingCode } from '@porcelain/client/access/rules';
import { accessSession, applicationRuntime } from '../store';
import { ConnectionError } from '@porcelain/client/transport';
import { REQUEST_TIMEOUT_MS } from '@/config/limits';

const pairing = pairBrowserSession({
  transport: browserTransport(fetch),
  platform: pairingPlatform,
});

export async function pairBrowser(
  registry: AtomRegistry.AtomRegistry,
  link: PairingCode,
  signal: AbortSignal,
) {
  const complete = applicationRuntime.runSync(accessSession.beginConnection());
  const requestSignal = AbortSignal.any([
    signal,
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  ]);
  const exit = await Effect.runPromiseExit(
    Effect.acquireUseRelease(
      Effect.sync(() => registry.set(pairing, link)),
      () =>
        AtomRegistry.getResult(registry, pairing, { suspendOnWaiting: true }),
      () => Effect.sync(() => registry.set(pairing, Atom.Interrupt)),
    ),
    { signal: requestSignal },
  );
  if (Exit.isFailure(exit))
    throw new ConnectionError({
      message: connectionErrorMessage(Cause.squash(exit.cause)),
      cause: Cause.squash(exit.cause),
    });
  const session = exit.value;
  if (complete) await applicationRuntime.runPromise(complete(session));
  if (
    accessSession.state.value.connection?.environmentId !==
    session.inventory.environmentId
  )
    throw new ConnectionError({
      message: 'Could not connect to the environment. Try again.',
    });
}
