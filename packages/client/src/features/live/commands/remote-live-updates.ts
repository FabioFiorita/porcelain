import type { StatusActivity } from '../../access/ports/status-activity.ts';
import type { createRouteTransport } from '../../access/store/route-transport.ts';
import { Cause, Effect, Exit } from 'effect';
import type { Socket } from 'effect/socket';
import { liveUpdatesUrl } from '../../access/api.ts';
import { BootstrapClient } from '../../../shared/api/bootstrap-client.ts';
import { mapRequestErrors } from '../../../shared/api/effect-client.ts';
import type { Transport } from '../../../shared/api/transport.ts';
import { createLiveUpdates } from './live-updates.ts';
import { RequestError } from '../../../shared/api/request-error.ts';

export function remoteLiveUpdates(
  address: string,
  transport: Transport,
  socket: (url: string) => Effect.Effect<Socket.Socket>,
  routing?: ReturnType<typeof createRouteTransport>,
  activity?: StatusActivity,
) {
  const open = Effect.gen(function* () {
    const route = routing ? yield* routing.select() : undefined;
    if (route && routing)
      yield* Effect.addFinalizer((exit) =>
        Effect.sync(() => {
          if (Exit.isFailure(exit) && !Cause.hasInterrupts(exit.cause))
            routing.failed(route);
        }),
      );
    const { ticket } = yield* Effect.gen(function* () {
      const api = yield* BootstrapClient;
      return yield* mapRequestErrors(api.session.issueLiveTicket());
    }).pipe(
      Effect.provide(
        BootstrapClient.layer(
          route && routing ? routing.transportFor(route) : transport,
        ),
      ),
    );
    const origin = new URL(route?.address ?? address);
    const protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
    return yield* socket(
      `${protocol}//${origin.host}${liveUpdatesUrl({ query: { ticket } })}`,
    );
  });
  return createLiveUpdates(open, undefined, {
    ...(activity ? { activity } : {}),
    ...(routing ? { onForeground: routing.reset } : {}),
    ...(routing
      ? {
          recoverUnauthorized: () =>
            routing.select().pipe(
              Effect.match({
                onSuccess: () => true,
                onFailure: (error) =>
                  !(error instanceof RequestError && error.status === 401),
              }),
            ),
        }
      : {}),
  });
}
