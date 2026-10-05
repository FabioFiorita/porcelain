import { Effect } from 'effect';
import type { Socket } from 'effect/socket';
import { accessApi, liveUpdatesUrl } from '../../access/api.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import type { Transport } from '../../../shared/api/transport.ts';
import { createLiveUpdates } from './live-updates.ts';

export function remoteLiveUpdates(
  address: string,
  transport: Transport,
  socket: (url: string) => Effect.Effect<Socket.Socket>,
) {
  const open = Effect.flatMap(
    requestEffect(accessApi({ transport }).session.issueLiveTicket()),
    ({ ticket }) => {
      const origin = new URL(address);
      const protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
      return socket(
        `${protocol}//${origin.host}${liveUpdatesUrl({ query: { ticket } })}`,
      );
    },
  );
  return createLiveUpdates(open);
}
