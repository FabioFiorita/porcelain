import { Effect } from 'effect';
import { Socket } from 'effect/socket';

export function mobileSocket(url: string) {
  return Socket.makeWebSocket(url).pipe(
    Effect.provideService(
      Socket.WebSocketConstructor,
      (address) => new WebSocket(address),
    ),
  );
}
