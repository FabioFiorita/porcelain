import { Effect, Option, Semaphore } from 'effect';
import { AtomRef } from 'effect/reactivity';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import {
  remoteTransport,
  type Transport,
} from '../../../shared/api/transport.ts';
import {
  connectionRoutes,
  type Remote,
  type ConnectionRoute,
} from '../rules/remotes.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import { readRemoteRoute } from '../queries/environments.ts';
import { remoteStatus } from '../rules/remotes.ts';
import type { AccessPlatformValue } from '../ports/access-platform.ts';
import { REMOTE_ROUTE_TIMEOUT_MS } from '../../../config/limits.ts';

export function createRouteTransport(
  remote: Remote,
  send: AccessPlatformValue['send'],
) {
  const active = AtomRef.make<ConnectionRoute | undefined>(undefined);
  const gate = Semaphore.makeUnsafe(1);
  const select = Effect.fn('RemoteRoute.select')((refresh = false) =>
    Effect.gen(function* () {
      if (refresh) active.set(undefined);
      if (active.value) return active.value;
      let refused = false;
      for (const route of connectionRoutes(remote)) {
        const result = yield* readRemoteRoute(
          route,
          remote.environmentId,
          send,
        ).pipe(Effect.timeoutOption(REMOTE_ROUTE_TIMEOUT_MS));
        if (
          Option.isSome(result) &&
          remoteStatus(remote, result.value).kind === 'online'
        ) {
          active.set(route);
          return route;
        }
        if (Option.isSome(result) && result.value.kind === 'unauthorized')
          refused = true;
      }
      if (refused)
        return yield* Effect.fail(
          new RequestError({
            status: 401,
            message:
              'This computer no longer accepts the saved connections. Pair it again.',
          }),
        );
      return yield* Effect.fail(
        new ConnectionError({
          message:
            'None of this computer’s saved connections could be reached and authorized.',
        }),
      );
    }).pipe(Semaphore.withPermit(gate)),
  );
  const transportFor = (route: ConnectionRoute) =>
    remoteTransport(route.address, route.credential, send);
  const transport: Transport = async (path, init) => {
    const options = { ...(init?.signal ? { signal: init.signal } : {}) };
    const route = await Effect.runPromise(select(), options);
    const read =
      init?.method === undefined ||
      init.method === 'GET' ||
      init.method === 'HEAD';
    let response: Response;
    try {
      response = await transportFor(route)(path, init);
    } catch (error) {
      if (active.value === route) active.set(undefined);
      if (!read || init?.signal?.aborted) throw error;
      const fallback = await Effect.runPromise(select(), options);
      if (fallback.address === route.address) throw error;
      return transportFor(fallback)(path, init);
    }
    if (response.status !== 401) return response;
    if (active.value === route) active.set(undefined);
    if (!read) return response;
    const fallback = await Effect.runPromise(
      select().pipe(Effect.option),
      options,
    );
    return Option.isSome(fallback) && fallback.value.address !== route.address
      ? transportFor(fallback.value)(path, init)
      : response;
  };

  return {
    active,
    select,
    transport,
    transportFor,
  };
}
