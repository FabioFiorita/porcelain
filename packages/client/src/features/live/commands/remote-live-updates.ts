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
) {
  const open = Effect.gen(function* () {
    const api = yield* BootstrapClient;
    const { ticket } = yield* mapRequestErrors(api.session.issueLiveTicket());
    const origin = new URL(address);
    const protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
    return yield* socket(
      `${protocol}//${origin.host}${liveUpdatesUrl({ query: { ticket } })}`,
    );
  }).pipe(Effect.provide(BootstrapClient.layer(transport)));
  return createLiveUpdates(open);
}
