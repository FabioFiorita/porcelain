import { WebSocketServer, type WebSocket } from 'ws';
import type { Duplex } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { Context } from 'effect';

export class NodeLiveSockets extends Context.Service<
  NodeLiveSockets,
  {
    readonly get: (request: IncomingMessage) => WebSocket | undefined;
  }
>()('@porcelain/server/NodeLiveSockets') {}

export function nodeLiveSockets(maxPayload: number) {
  const sockets = new WeakMap<IncomingMessage, WebSocket>();
  class LiveServer extends WebSocketServer {
    override handleUpgrade(
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: (socket: WebSocket, request: IncomingMessage) => void,
    ) {
      super.handleUpgrade(request, socket, head, (opened, incoming) => {
        sockets.set(incoming, opened);
        callback(opened, incoming);
      });
    }
  }
  const server = new LiveServer({ noServer: true, maxPayload });
  return { server, get: (request: IncomingMessage) => sockets.get(request) };
}
