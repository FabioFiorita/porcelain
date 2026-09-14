export {
  parseServeSettings,
  ServeConfigurationError,
  type ServeSettings,
} from './arguments.ts';
export { runLocalServer } from './launcher.ts';
export { installShutdownSignals } from './signals.ts';
export { ensureAccessToken } from './token.ts';

export const serveHelp = `Usage: porcelain serve [options]

Serves the built web app and starts the persistent Porcelain server on one origin.

Options:
  --lan                    Listen on 0.0.0.0 for LAN access
  --host <host>            Listen host (default: 127.0.0.1)
  --port <port>            Listen port (default: 3000)
  --data-directory <path>  Persistent state directory (default: ~/.porcelain)
  --token-file <path>      Persistent access token file (default: <data-directory>/admin-token)
  -h, --help               Show this help
`;
