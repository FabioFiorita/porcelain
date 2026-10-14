import { developmentPairing } from '@porcelain/server/kit/development-pairing';
import type { Plugin } from 'vite';

export function devPair(ownerSocket: string, serverAddress: string): Plugin {
  return {
    name: 'porcelain-dev-pair',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(
        developmentPairing({
          ownerSocket,
          serverAddress,
          label: 'Development browser',
          response: 'redirect',
        }),
      );
    },
  };
}
