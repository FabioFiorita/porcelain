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
  const routes = connectionRoutes(remote);
  const failedRoutes = new Set<string>();
  const reset = () => {
    failedRoutes.clear();
    active.set(undefined);
  };
  const failed = (route: ConnectionRoute) => {
    failedRoutes.add(route.address);
    if (active.value?.address === route.address) active.set(undefined);
  };
  const gate = Semaphore.makeUnsafe(1);
  const select = Effect.fn('RemoteRoute.select')((refresh = false) =>
    Effect.gen(function* () {
      if (refresh) reset();
      if (active.value) return active.value;
      if (routes.every((route) => failedRoutes.has(route.address)))
        failedRoutes.clear();
      let refused = 0;
      for (const route of routes) {
        if (failedRoutes.has(route.address)) continue;
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
          refused++;
      }
      failedRoutes.clear();
      if (refused === routes.length)
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
    const sendRoute = async (selected: ConnectionRoute) => {
      try {
        const response = await transportFor(selected)(path, init);
        if (response.status === 401) failed(selected);
        return response;
      } catch (error) {
        if (!init?.signal?.aborted) failed(selected);
        throw error;
      }
    };
    let response: Response;
    try {
      response = await sendRoute(route);
    } catch (error) {
      if (!read || init?.signal?.aborted || routes.length === 1) throw error;
      const fallback = await Effect.runPromise(select(), options);
      if (fallback.address === route.address) throw error;
      return sendRoute(fallback);
    }
    if (response.status !== 401) return response;
    if (!read || routes.length === 1) return response;
    const fallback = await Effect.runPromise(
      select().pipe(Effect.option),
      options,
    );
    return Option.isSome(fallback) && fallback.value.address !== route.address
      ? sendRoute(fallback.value)
      : response;
  };

  return {
    active,
    reset,
    failed,
    select,
    transport,
    transportFor,
  };
}
