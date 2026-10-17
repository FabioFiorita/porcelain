import type { StatusActivity } from '../../access/ports/status-activity.ts';
import type { createRouteTransport } from '../../access/store/route-transport.ts';
import { Effect } from 'effect';
import type { Socket } from 'effect/socket';
import { liveUpdatesUrl } from '../../access/api.ts';
import { BootstrapClient } from '../../../shared/api/bootstrap-client.ts';
import { mapRequestErrors } from '../../../shared/api/effect-client.ts';
import type { Transport } from '../../../shared/api/transport.ts';
import { createLiveUpdates } from './live-updates.ts';

export function remoteLiveUpdates(
  address: string,
  transport: Transport,
  socket: (url: string) => Effect.Effect<Socket.Socket>,
  routing?: ReturnType<typeof createRouteTransport>,
  activity?: StatusActivity,
) {
  const open = Effect.gen(function* () {
    const route = routing ? yield* routing.select(true) : undefined;
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
    ...(routing
      ? {
          recoverUnauthorized: () =>
            routing.select(true).pipe(
              Effect.as(true),
              Effect.orElseSucceed(() => false),
            ),
        }
      : {}),
  });
}
