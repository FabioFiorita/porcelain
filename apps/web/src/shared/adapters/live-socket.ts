import { Effect } from 'effect';
import { Socket } from 'effect/socket';
import { liveUpdatesUrl } from '@porcelain/client/access/api';
import { createLiveUpdates } from '@porcelain/client/live';
import { desktopLiveAddress } from './desktop';

export function webSocket(url: string) {
  return Socket.makeWebSocket(url).pipe(
    Effect.provideService(
      Socket.WebSocketConstructor,
      (address) => new WebSocket(address),
    ),
  );
}

export function sameOriginLiveUpdates() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const address =
    desktopLiveAddress() ??
    `${protocol}//${location.host}${liveUpdatesUrl({ query: {} })}`;
  return createLiveUpdates(webSocket(address));
}
