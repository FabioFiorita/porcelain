export {
  parseCliArguments,
  ServeConfigurationError,
  type ServeSettings,
} from './arguments.ts';
export { runLocalServer } from './launcher.ts';
export { installShutdownSignals } from './signals.ts';
export { reportStatus, statusExitCodes } from './status.ts';
export { ensureAccessToken } from './token.ts';

export const serveHelp = `Usage: porcelain <command> [options]

Commands:
  serve                    Serve the built web app and the Porcelain server
  status                   Report whether a server owns the data directory
  help                     Show this help

Options:
  --lan                    Listen on 0.0.0.0 for LAN access
  --host <host>            Listen host (default: 127.0.0.1)
  --allow-host <host>      Answer to this host name as well (repeatable)
  --port <port>            Listen port (default: 3000)
  --data-directory <path>  Persistent state directory (default: ~/.porcelain)
  --token-file <path>      Persistent access token file (default: <data-directory>/admin-token)
  -h, --help               Show this help
`;
