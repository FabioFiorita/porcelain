import { Effect } from 'effect';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { connect, createServer, type Socket } from 'node:net';
import { join } from 'node:path';
import type { LiveConnector } from '../../src/ports/live-connector.ts';

const gatePath = (root: string) => join(root, 'live-retirement.sock');

export function gatedLiveConnector(
  root: string,
  connector: LiveConnector,
): LiveConnector {
  const path = gatePath(root);
  const wait = Effect.suspend(() =>
    existsSync(path)
      ? Effect.callback<void>((resume) => {
          const socket = connect(path);
          socket.once('end', () => resume(Effect.void));
          socket.once('error', (error) => resume(Effect.die(error)));
          return Effect.sync(() => socket.destroy()).pipe(Effect.asVoid);
        })
      : Effect.void,
  );
  return {
    connect: (channel) =>
      connector.connect({
        ...channel,
        terminate: () => wait.pipe(Effect.andThen(channel.terminate())),
      }),
  };
}

export async function holdLiveRetirement(root: string) {
  const held = new Set<Socket>();
  const server = createServer((socket) => {
    held.add(socket);
    socket.once('close', () => held.delete(socket));
  });
  server.listen(gatePath(root));
  await once(server, 'listening');
  let closing: Promise<void> | undefined;
  return {
    hasPeer: () => held.size > 0,
    release: () =>
      (closing ??= new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        for (const socket of held) socket.end();
      })),
  };
}
