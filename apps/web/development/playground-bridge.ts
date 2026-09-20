import type { IncomingMessage, ServerResponse } from 'node:http';
import { overSocket } from '../../server/src/development/pair-through-socket.ts';

/**
 * Where the link comes from, given the server's address and socket, or a host
 * that knows both and may change them under us — which the server lab does
 * every time it restarts its runtime into a fresh data directory.
 */
async function mintedHere(socketPath: string, address: string) {
  const issued = (await overSocket(socketPath, '/pairings', {
    labels: [`Playground browser ${new Date().toISOString()}`],
    addresses: [new URL(address).origin],
  })) as { grants: { link: string }[] };
  const link = issued.grants[0]?.link;
  if (!link) throw new Error('The owner socket issued no pairing link');
  return link;
}

async function mintedElsewhere(mintUrl: string) {
  const response = await fetch(mintUrl, { method: 'POST' });
  if (!response.ok) throw new Error(`Minting answered ${response.status}`);
  const { link } = (await response.json()) as { link?: string };
  if (!link) throw new Error('Minting returned no link');
  return link;
}

/**
 * Hand the page in front of the developer a pairing link of its own.
 *
 * A grant is consumed once, so this mints a fresh one per request rather than
 * revealing anything reusable: there is no shared playground credential to
 * copy, reveal or leave in a manifest. The authority to mint is reaching the
 * owner socket, which only a process on this machine can do — the browser is
 * asking the dev server, not the Porcelain server.
 */
export function playgroundBridge(
  source:
    | { socketPath: string; address: string }
    | { mintUrl: string; address?: undefined },
) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ) => {
    if (request.url !== '/__porcelain/playground') {
      next();
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    const host = request.headers.host ?? '';
    if (
      request.method !== 'POST' ||
      !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ||
      request.headers.origin !== `http://${host}` ||
      request.headers['x-porcelain-playground'] !== '1' ||
      (request.headers['sec-fetch-site'] !== undefined &&
        request.headers['sec-fetch-site'] !== 'same-origin')
    ) {
      response.writeHead(403).end();
      return;
    }
    try {
      // The whole link, so the page reads it with the same parser it uses for
      // one the owner opened by hand.
      const link =
        source.address === undefined
          ? await mintedElsewhere(source.mintUrl)
          : await mintedHere(source.socketPath, source.address);
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ link }));
    } catch {
      response.writeHead(503).end();
    }
  };
}
